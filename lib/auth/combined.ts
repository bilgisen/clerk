import { SignJWT, jwtVerify, decodeJwt, JWTPayload, importPKCS8, importSPKI, base64url } from "jose";
import { v4 as uuidv4 } from 'uuid';

type KeyLike = CryptoKey | Uint8Array;

// Extend Error type to include code
interface JWTError extends Error {
  code?: string;
}

// Custom error class for JWT verification
class JWTVerificationError extends Error {
  code: string;
  
  constructor(message: string, code: string) {
    super(message);
    this.name = 'JWTVerificationError';
    this.code = code;
  }
}

const ALG = (process.env.COMBINED_JWT_ALG || "HS256") as "HS256";
const AUD = process.env.COMBINED_JWT_AUD || 'clerk-js';

// Key management
let signingKey: Uint8Array;

if (ALG === "HS256") {
  if (!process.env.COMBINED_JWT_SECRET) {
    throw new Error("COMBINED_JWT_SECRET is required for HS256");
  }
  signingKey = new TextEncoder().encode(process.env.COMBINED_JWT_SECRET);
} else {
  throw new Error(`Unsupported algorithm: ${ALG}. Only HS256 is supported in Edge Runtime.`);
}

export type CombinedTokenClaims = {
  // Standard JWT claims
  iss: string;         // Issuer (your application)
  sub: string;         // Subject (Clerk user ID)
  aud: string;         // Audience (should match COMBINED_JWT_AUD)
  exp: number;         // Expiration time (Unix timestamp)
  iat: number;         // Issued at (Unix timestamp)
  jti: string;         // JWT ID
  nbf?: number;        // Not before (Unix timestamp, optional)
  
  // Custom claims
  sid: string;         // Session ID (from publish session)
  scope: "publish";    // Fixed scope for publish operations
  
  // GitHub context
  gh: {
    repository: string;  // "org/repo"
    run_id: string;     // GitHub Actions run ID
    run_number?: string; // GitHub Actions run number
    workflow: string;   // Workflow filename
    sha?: string;       // Commit SHA
    actor?: string;     // GitHub username who triggered the workflow
  };
};

/**
 * Signs a new Combined Token
 * @param claims The claims to include in the token
 * @param ttlSeconds Token time-to-live in seconds (default: 15 minutes)
 * @returns Signed JWT string
 */
export async function signCombinedToken(
  claims: Omit<CombinedTokenClaims, 'iss' | 'aud' | 'exp' | 'iat' | 'jti'>,
  ttlSeconds = 15 * 60
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setIssuer('clerk')
    .setAudience(AUD)
    .setSubject(claims.sub)
    .setJti(uuidv4())
    .setExpirationTime(now + ttlSeconds)
    .sign(signingKey);
}

/**
 * Verifies a Combined Token
 * @param token JWT token to verify
 * @returns Decoded and verified token claims
 * @throws {jose.errors.JOSEError} If verification fails
 */
export async function verifyCombinedToken(token: string): Promise<CombinedTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, signingKey, {
      algorithms: [ALG],
      audience: AUD,
      issuer: 'clerk'
    });

    return payload as CombinedTokenClaims;
  } catch (error) {
    const err = error as JWTError;
    
    // Provide more specific error messages
    if (err.name === 'JWTExpired') {
      throw new JWTVerificationError('Token has expired', 'TOKEN_EXPIRED');
    }
    
    if (err.name === 'JWSInvalid' || err.name === 'JWTInvalid') {
      throw new JWTVerificationError('Invalid token', 'INVALID_TOKEN');
    }
    
    if (err.name === 'JWTClaimValidationFailed') {
      throw new JWTVerificationError('Token validation failed', 'VALIDATION_FAILED');
    }
    
    // Re-throw any other errors with additional context
    throw new JWTVerificationError(
      `Token verification failed: ${err.message}`,
      err.code || 'VERIFICATION_FAILED'
    );
  }
}

/**
 * Extracts the JWT payload without verification
 * @param token JWT token to decode
 * @returns Decoded token payload (not verified)
 */
export function decodeCombinedToken(token: string): CombinedTokenClaims | null {
  try {
    const payload = decodeJwt(token);
    return payload as unknown as CombinedTokenClaims;
  } catch (error) {
    return null;
  }
}

/**
 * Checks if a token is expired without verifying the signature
 * @param token JWT token to check
 * @returns True if token is expired, false otherwise
 */
export function isTokenExpired(token: string): boolean {
  const claims = decodeCombinedToken(token);
  if (!claims) return true;
  
  const now = Math.floor(Date.now() / 1000);
  return claims.exp <= now;
}
