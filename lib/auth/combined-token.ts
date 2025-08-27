import { SignJWT, jwtVerify, JWTPayload, JWTVerifyResult } from 'jose';
import { PublishSession } from '../store/redis';

const ALG = 'EdDSA';
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

export async function generateCombinedToken(
  session: PublishSession,
  privateKey: string,
  audience: string,
  expiresIn = DEFAULT_TTL
): Promise<string> {
  const privateKeyObj = await importPKCS8(privateKey, ALG);
  const now = Math.floor(Date.now() / 1000);
  
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
    .setExpirationTime(now + expiresIn)
    .sign(privateKeyObj);
}

export async function verifyCombinedToken(
  token: string,
  publicKey: string,
  audience: string
): Promise<CombinedTokenPayload> {
  try {
    const publicKeyObj = await importSPKI(publicKey, ALG);
    const { payload } = await jwtVerify(token, publicKeyObj, {
      algorithms: [ALG],
      audience,
      clockTolerance: 30, // 30 seconds clock skew tolerance
    });

    return payload as CombinedTokenPayload;
  } catch (error) {
    if (error.code === 'ERR_JWT_EXPIRED') {
      throw new Error('Token has expired');
    }
    if (error.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
      throw new Error('Invalid token claims');
    }
    throw new Error('Invalid token');
  }
}

// Helper function to import PKCS8 formatted private key
async function importPKCS8(pem: string, alg: string) {
  const pemContents = pem
    .toString()
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'EdDSA', namedCurve: 'Ed25519' },
    false,
    ['sign']
  );
}

// Helper function to import SPKI formatted public key
async function importSPKI(pem: string, alg: string) {
  const pemContents = pem
    .toString()
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s+/g, '');
  
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'spki',
    binaryDer,
    { name: 'EdDSA', namedCurve: 'Ed25519' },
    false,
    ['verify']
  );
}
