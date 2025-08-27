import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { createPrivateKey, createPublicKey } from 'crypto';

const ALG = 'RS256';
const DEFAULT_TTL = 15 * 60; // 15 minutes in seconds

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

// Load and validate keys from environment
function getKeys() {
  if (!process.env.COMBINED_JWT_PRIVATE_KEY || !process.env.COMBINED_JWT_PUBLIC_KEY) {
    throw new Error('JWT keys not configured in environment variables');
  }

  // Decode base64 to PEM
  const privateKeyPem = Buffer.from(process.env.COMBINED_JWT_PRIVATE_KEY, 'base64').toString('utf8');
  const publicKeyPem = Buffer.from(process.env.COMBINED_JWT_PUBLIC_KEY, 'base64').toString('utf8');

  // Validate PEM format
  if (!privateKeyPem.startsWith('-----BEGIN PRIVATE KEY-----')) {
    throw new Error('Invalid private key format');
  }
  if (!publicKeyPem.startsWith('-----BEGIN PUBLIC KEY-----')) {
    throw new Error('Invalid public key format');
  }

  return {
    privateKey: createPrivateKey(privateKeyPem),
    publicKey: createPublicKey(publicKeyPem)
  };
}

export async function generateCombinedToken(
  session: { id: string; userId: string; contentId: string; nonce: string; gh?: any },
  audience: string,
  expiresIn: string | number = DEFAULT_TTL
): Promise<string> {
  const { privateKey } = getKeys();
  
  return new SignJWT({
    session_id: session.id,
    user_id: session.userId,
    content_id: session.contentId,
    nonce: session.nonce,
    gh: session.gh,
  })
    .setProtectedHeader({ alg: ALG, typ: 'JWT' })
    .setSubject(session.id)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(typeof expiresIn === 'number' ? expiresIn : `${expiresIn}s`)
    .sign(privateKey);
}

export async function verifyCombinedToken(
  token: string,
  audience: string
): Promise<CombinedTokenPayload> {
  const { publicKey } = getKeys();
  
  try {
    const { payload } = await jwtVerify(token, publicKey, {
      algorithms: [ALG],
      audience,
      clockTolerance: 30, // 30 seconds clock skew tolerance
    });

    return payload as CombinedTokenPayload;
  } catch (error: any) {
    if (error.code === 'ERR_JWT_EXPIRED') {
      throw new Error('Token has expired');
    }
    if (error.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
      throw new Error('Invalid token claims');
    }
    throw new Error('Invalid token: ' + error.message);
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
