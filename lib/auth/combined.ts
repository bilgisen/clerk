import { SignJWT, jwtVerify, decodeJwt, JWTPayload, importPKCS8, importSPKI } from "jose";
import { randomUUID } from "crypto";

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

const ALG = (process.env.COMBINED_JWT_ALG || "EdDSA") as "EdDSA" | "HS256";
const AUD = process.env.COMBINED_JWT_AUD!;

// Key management
let keyPromise: Promise<KeyLike | Uint8Array>;

if (ALG === "EdDSA") {
  if (!process.env.COMBINED_JWT_PRIVATE_KEY) {
    throw new Error("COMBINED_JWT_PRIVATE_KEY is required for EdDSA");
  }
  keyPromise = importPKCS8(process.env.COMBINED_JWT_PRIVATE_KEY, "Ed25519");
} else {
  if (!process.env.COMBINED_JWT_SECRET) {
    throw new Error("COMBINED_JWT_SECRET is required for HS256");
  }
  keyPromise = Promise.resolve(new TextEncoder().encode(process.env.COMBINED_JWT_SECRET));
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
  const key = await keyPromise;
  const now = Math.floor(Date.now() / 1000);
  
  const jwt = new SignJWT({
    ...claims,
    // Ensure these can't be overridden
    iss: "clerko",
    aud: AUD,
    iat: now,
    exp: now + ttlSeconds,
    jti: randomUUID(),
  });
  
  return await jwt
    .setProtectedHeader({ alg: ALG, typ: 'JWT' })
    .sign(key);
}

/**
 * Verifies a Combined Token
 * @param token JWT token to verify
 * @returns Decoded and verified token claims
 * @throws {jose.errors.JOSEError} If verification fails
 */
export async function verifyCombinedToken(token: string): Promise<CombinedTokenClaims> {
  let key: KeyLike | Uint8Array;
  
  if (ALG === "EdDSA") {
    if (!process.env.COMBINED_JWT_PUBLIC_KEY) {
      throw new Error("COMBINED_JWT_PUBLIC_KEY is required for EdDSA verification");
    }
key = await importSPKI(process.env.COMBINED_JWT_PUBLIC_KEY, "Ed25519");
  } else {
    key = new TextEncoder().encode(process.env.COMBINED_JWT_SECRET!);
  }
  
  try {
    const { payload } = await jwtVerify(token, key, {
      audience: AUD,
      algorithms: [ALG],
    });
  
    // Type assertion with runtime validation
    const claims = payload as unknown as CombinedTokenClaims;
  
    // Validate required claims
    if (!claims.sid || !claims.gh || !claims.gh.repository || !claims.gh.run_id || !claims.gh.workflow) {
      throw new JWTVerificationError(
        "Missing required claims in Combined Token",
        "ERR_INVALID_CLAIMS"
      );
    }
  
    // Validate scope
    if (claims.scope !== "publish") {
      throw new JWTVerificationError(
        "Invalid scope in Combined Token",
        "ERR_INVALID_SCOPE"
      );
    }
  
    return claims;
  } catch (error) {
    if (error instanceof Error) {
      const jwtError = new JWTVerificationError(
        error.message,
        (error as JWTError).code || 'JWT_VERIFICATION_ERROR'
      );
      throw jwtError;
    }
    throw new Error("Failed to verify token");
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
