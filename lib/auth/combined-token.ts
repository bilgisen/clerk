import { SignJWT, jwtVerify, JWTPayload, importPKCS8, importSPKI } from 'jose';

const ALG = 'EdDSA';
const DEFAULT_TTL = 15 * 60; // 15 minutes in seconds

// Debug logger
function debugLog(message: string, data?: any) {
  console.log(`[DEBUG][${new Date().toISOString()}] ${message}`, data || '');
}

export interface CombinedTokenPayload extends JWTPayload {
  // Standard claims
  sub: string;          // Session ID
  aud: string;          // Intended audience (e.g., 'clerk-actions')
  iat: number;          // Issued at
  exp: number;          // Expiration time
  nbf?: number;         // Not before
  jti?: string;         // JWT ID
  
  // Custom claims
  session_id: string;   // Reference to the publish session
  user_id: string;      // User who initiated the publish
  content_id: string;   // Content being published
  nonce: string;        // Nonce for replay protection
  
  // GitHub context (from OIDC token)
  gh?: {
    repository?: string;
    run_id?: string;
    workflow?: string;
    sha?: string;
  };
}

// Load and validate EdDSA keys from environment
async function getKeys() {
  debugLog('Loading EdDSA JWT keys from environment...');
  
  const privateKeyPem = process.env.COMBINED_JWT_PRIVATE_KEY;
  const publicKeyPem = process.env.COMBINED_JWT_PUBLIC_KEY;

  if (!privateKeyPem || !publicKeyPem) {
    const error = new Error('EdDSA JWT keys not configured in environment variables');
    debugLog('Missing JWT keys in environment', {
      hasPrivateKey: !!privateKeyPem,
      hasPublicKey: !!publicKeyPem
    });
    throw error;
  }

  try {
    debugLog('Importing EdDSA keys...');
    
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
  session: { id: string; userId: string; contentId: string; nonce: string; gh?: any },
  audience: string,
  expiresIn: string | number = DEFAULT_TTL
): Promise<string> {
  const { privateKey } = await getKeys();
  
  const now = Math.floor(Date.now() / 1000);
  const exp = typeof expiresIn === 'number' 
    ? now + expiresIn 
    : Math.floor(new Date(expiresIn).getTime() / 1000);

  const payload: CombinedTokenPayload = {
    sub: session.id,
    aud: audience,
    iat: now,
    exp,
    nbf: now,
    jti: `ct_${session.id}_${Date.now()}`,
    session_id: session.id,
    user_id: session.userId,
    content_id: session.contentId,
    nonce: session.nonce,
    gh: session.gh
  };

  debugLog('Generating token with payload', payload);
  
  try {
    const token = await new SignJWT(payload as any)
      .setProtectedHeader({ 
        alg: ALG,
        typ: 'JWT' 
      })
      .setIssuedAt()
      .setExpirationTime(exp)
      .setNotBefore(now)
      .setSubject(session.id)
      .setAudience(audience)
      .setJti(payload.jti!)
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
  const { publicKey } = await getKeys();
  
  debugLog('Verifying token', { token, audience });
  
  try {
    const { payload } = await jwtVerify(token, publicKey, {
      algorithms: [ALG],
      audience,
      clockTolerance: 30, // 30 seconds leeway for clock skew
      requiredClaims: ['exp', 'iat', 'sub', 'aud'],
      typ: 'JWT'
    });

    debugLog('Token verified successfully', { payload });
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

// For testing purposes
export async function testTokenFlow() {
  const testPayload = {
    id: 'test-session-123',
    userId: 'user-123',
    contentId: 'content-456',
    nonce: 'random-nonce-789',
    gh: {
      repository: 'test/repo',
      run_id: '123456789'
    }
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
