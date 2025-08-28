import { SignJWT, jwtVerify, JWTPayload, importPKCS8, importSPKI } from 'jose';

const ALG = 'EdDSA';
const DEFAULT_TTL = 15 * 60; // 15 minutes in seconds

// Debug logger
function debugLog(message: string, data?: any) {
  console.log(`[DEBUG][${new Date().toISOString()}] ${message}`, data || '');
}

export interface GitHubOIDCContext {
  repository?: string;
  run_id?: string;
  run_number?: string;
  workflow?: string;
  sha?: string;
  actor?: string;
  event_name?: string;
  ref?: string;
  head_ref?: string;
  base_ref?: string;
}

export interface GenerateTokenParams {
  sessionId: string;
  userId: string;
  contentId: string;
  nonce: string;
  tokenType: 'user' | 'ci';
  permissions?: {
    can_publish?: boolean;
    can_generate?: boolean;
    can_manage?: boolean;
  };
  gh?: GitHubOIDCContext;
  metadata?: Record<string, unknown>;
  status?: string;
  progress?: number;
  phase?: string;
  message?: string;
}

export interface CombinedTokenPayload extends JWTPayload {
  // Standard JWT claims
  sub: string;      // Session ID (matches Redis session.id)
  aud: string;      // Intended audience (e.g., 'clerk-actions')
  iat: number;      // Issued at
  exp: number;      // Expiration time
  nbf: number;      // Not before
  jti: string;      // JWT ID

  // Session context (aligned with PublishSession)
  session_id: string;  // Matches Redis session.id
  user_id: string;     // Clerk user ID
  content_id: string;  // Content being published
  nonce: string;       // For replay protection
  status?: string;     // Session status (pending, generating, completed, failed)
  
  // Token type and permissions
  token_type: 'user' | 'ci';
  permissions: {
    can_publish: boolean;
    can_generate: boolean;
    can_manage: boolean;
  };

  // GitHub OIDC context (for CI tokens)
  gh?: GitHubOIDCContext;
  
  // Additional metadata
  metadata?: Record<string, unknown>;
  
  // Progress tracking (for long-running operations)
  progress?: number;
  phase?: string;
  message?: string;
}

// Load and validate EdDSA keys from environment
export async function getKeys() {
  debugLog('Loading EdDSA JWT keys from environment...');
  
  const privateKeyB64 = process.env.COMBINED_JWT_PRIVATE_KEY_B64;
  const publicKeyB64 = process.env.COMBINED_JWT_PUBLIC_KEY_B64;

  if (!privateKeyB64 || !publicKeyB64) {
    const error = new Error('EdDSA JWT keys not configured in environment variables');
    debugLog('Missing JWT keys in environment', {
      hasPrivateKey: !!privateKeyB64,
      hasPublicKey: !!publicKeyB64
    });
    throw error;
  }

  try {
    debugLog('Decoding and importing EdDSA keys...');
    
    // Decode base64 to PEM format
    const privateKeyPem = Buffer.from(privateKeyB64, 'base64').toString('utf-8');
    const publicKeyPem = Buffer.from(publicKeyB64, 'base64').toString('utf-8');
    
    // Import private key (PKCS#8 format expected)
    const privateKey = await importPKCS8(privateKeyPem, ALG);
    
    // Import public key (SPKI format expected)
    const publicKey = await importSPKI(publicKeyPem, ALG);
    
    debugLog('EdDSA keys imported successfully');
    return { privateKey, publicKey };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorObj = error as Error & { code?: string };
    
    debugLog('Error in getKeys', {
      error: errorMessage,
      stack: errorObj.stack,
      name: errorObj.name,
      code: errorObj.code
    });
    throw new Error(`Failed to initialize EdDSA JWT keys: ${errorMessage}`);
  }
}

export async function generateCombinedToken(
  params: GenerateTokenParams,
  audience: string,
  expiresIn: string | number = DEFAULT_TTL
): Promise<string> {
  const { privateKey } = await getKeys();
  const now = Math.floor(Date.now() / 1000);
  const exp = typeof expiresIn === 'number' 
    ? now + expiresIn 
    : Math.floor(new Date(expiresIn).getTime() / 1000);

  const payload: CombinedTokenPayload = {
    // Standard JWT claims
    sub: params.sessionId,
    aud: audience,
    iat: now,
    exp,
    nbf: now,
    jti: `ct_${params.sessionId}_${Date.now()}`,

    // Session context
    session_id: params.sessionId,
    user_id: params.userId,
    content_id: params.contentId,
    nonce: params.nonce,
    status: params.status,
    
    // Token type and permissions
    token_type: params.tokenType,
    permissions: {
      can_publish: params.permissions?.can_publish ?? false,
      can_generate: params.permissions?.can_generate ?? false,
      can_manage: params.permissions?.can_manage ?? false,
    },

    // GitHub OIDC context
    ...(params.gh && { gh: params.gh }),
    
    // Additional metadata
    ...(params.metadata && { metadata: params.metadata }),
    
    // Progress tracking
    ...(params.progress !== undefined && { progress: params.progress }),
    ...(params.phase && { phase: params.phase }),
    ...(params.message && { message: params.message }),
  };

  debugLog('Generating token with payload', { 
    payload: { ...payload, privateKey: '***' } 
  });

  try {
    const token = await new SignJWT(payload as any)
      .setProtectedHeader({ alg: ALG, typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime(exp)
      .setNotBefore(now)
      .setSubject(params.sessionId)
      .setAudience(audience)
      .setJti(payload.jti)
      .sign(privateKey);

    debugLog('Token generated successfully');
    return token;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    debugLog('Error generating token', { error: errorMessage });
    throw new Error(`Failed to generate token: ${errorMessage}`);
  }
}

export async function verifyCombinedToken(
  token: string,
  audience: string
): Promise<CombinedTokenPayload> {
  // This function only verifies Combined Tokens (EdDSA)
  // Clerk tokens should be verified and converted to Combined Tokens at the auth boundary

  const { publicKey } = await getKeys();
  
  debugLog('Verifying combined token', { token, audience });
  
  try {
    const { payload } = await jwtVerify(token, publicKey, {
      algorithms: ['EdDSA'],
      audience,
      clockTolerance: 30, // 30 seconds leeway for clock skew
      requiredClaims: ['exp', 'iat', 'sub', 'aud'],
      typ: 'JWT'
    });

    debugLog('Combined token verified successfully', { payload });
    return payload as CombinedTokenPayload;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorObj = error as Error & { code?: string };
    
    debugLog('Token verification failed', {
      error: errorMessage,
      code: errorObj.code,
      stack: errorObj instanceof Error ? errorObj.stack : undefined
    });
    
    if (errorObj.code === 'ERR_JWT_EXPIRED') {
      throw new Error('Token has expired');
    }
    if (errorObj.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
      throw new Error('Invalid token claims');
    }
    throw new Error(`Token verification failed: ${errorMessage}`);
  }
}

// Clerk token verification should happen in the auth boundary
// and issue a new Combined Token for API use

// For testing purposes
export async function testTokenFlow() {
  const testPayload: GenerateTokenParams = {
    sessionId: 'test-session-123',
    userId: 'user-123',
    contentId: 'content-456',
    nonce: 'random-nonce-789',
    tokenType: 'ci',
    permissions: {
      can_publish: true,
      can_generate: true,
      can_manage: false
    },
    gh: {
      repository: 'test/repo',
      run_id: '123456789',
      run_number: '1',
      workflow: 'test-workflow',
      sha: 'test-sha',
      actor: 'test-actor',
      event_name: 'push',
      ref: 'refs/heads/main',
      head_ref: 'test-head-ref',
      base_ref: 'test-base-ref'
    },
    status: 'active',
    progress: 0,
    phase: 'testing',
    message: 'Test token generation'
  };

  try {
    const token = await generateCombinedToken(testPayload, 'test-audience', '1h');
    console.log('Generated token:', token);
    
    const decoded = await verifyCombinedToken(token, 'test-audience');
    console.log('Decoded token:', decoded);
    
    return { token, decoded };
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testTokenFlow().catch(console.error);
}
