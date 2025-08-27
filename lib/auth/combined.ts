import { SignJWT, jwtVerify, decodeJwt, JWTPayload, importPKCS8, importSPKI, JWTVerifyResult, JWTVerifyOptions } from 'jose';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger';

type KeyLike = CryptoKey | Uint8Array;

// GitHub context in JWT payload
interface GitHubContext {
  repository: string;
  run_id: string;
  run_number?: string;
  workflow: string;
  sha?: string;
  actor?: string;
}

// Type for the raw JWT payload from decodeJwt
interface JWTPayloadWithClaims extends JWTPayload {
  sub?: string;
  sid?: string;
  scope?: string;
  gh?: GitHubContext;
}

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

const ALG = 'EdDSA' as const;
const AUD = process.env.COMBINED_JWT_AUD || 'clerk-js';

if (!process.env.COMBINED_JWT_PRIVATE_KEY) {
  throw new Error('COMBINED_JWT_PRIVATE_KEY is required');
}

if (!process.env.COMBINED_JWT_PUBLIC_KEY) {
  throw new Error('COMBINED_JWT_PUBLIC_KEY is required');
}

// Decode the base64 encoded private key
const privateKeyPem = Buffer.from(process.env.COMBINED_JWT_PRIVATE_KEY, 'base64').toString('utf-8');
const publicKeyPem = process.env.COMBINED_JWT_PUBLIC_KEY;

// Import keys
let privateKey: CryptoKey;
let publicKey: CryptoKey;

// Cache for the keys
let keysInitialized = false;

async function initializeKeys() {
  if (keysInitialized) return;
  
  try {
    if (!privateKeyPem || !publicKeyPem) {
      const error = new Error('JWT keys are not properly configured');
      logger.error(error.message);
      throw error;
    }
    
    logger.debug('Initializing JWT keys...');
    
    // Import private key
    privateKey = await importPKCS8(
      privateKeyPem,
      ALG
    );
    
    // Import public key
    publicKey = await importSPKI(
      publicKeyPem,
      ALG
    );
    
    keysInitialized = true;
    logger.info('JWT keys initialized successfully');
  } catch (error) {
    const errorMessage = 'Failed to initialize JWT keys';
    logger.error(errorMessage, { error });
    throw new Error(`${errorMessage}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Extended JWT payload with our custom claims
export interface CombinedTokenClaims {
  // Standard JWT claims
  iss: string;         // Issuer (e.g., 'clerk-js')
  sub: string;         // Subject (user ID)
  aud: string | string[]; // Audience (e.g., 'clerk-js')
  exp: number;         // Expiration time (seconds since epoch)
  iat: number;         // Issued at (seconds since epoch)
  jti: string;         // JWT ID
  nbf?: number;        // Not before (seconds since epoch)
  
  // Custom claims
  sid: string;         // Session ID
  scope: 'publish' | 'api';  // Token scope
  
  // User-friendly aliases
  userId: string;      // Alias for sub
  sessionId: string;   // Alias for sid
  
  // GitHub Actions context (for publish tokens)
  gh?: {
    repository: string;  // "org/repo"
    run_id: string;     // GitHub Actions run ID
    run_number?: string; // GitHub Actions run number
    workflow: string;   // Workflow filename
    sha?: string;       // Commit SHA
    actor?: string;     // GitHub username who triggered the workflow
  };
  
  // Custom metadata
  [key: string]: unknown;
}

/**
 * Signs a new Combined Token
 * @param claims The claims to include in the token
 * @param options Configuration options
 * @returns Signed JWT string
 */
export async function signCombinedToken(
  claims: Omit<CombinedTokenClaims, 'iss' | 'aud' | 'exp' | 'iat' | 'jti' | 'nbf'>,
  options: {
    issuer?: string;
    audience?: string | string[];
    expiresIn?: number; // in seconds
    notBefore?: number; // in seconds from now
  } = {}
): Promise<string> {
  try {
    await initializeKeys();
    
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = options.expiresIn ?? 15 * 60; // Default 15 minutes
    
    // Ensure required claims
    if (!claims.sub) {
      throw new Error('sub (subject) claim is required');
    }
    
    if (!claims.sid) {
      throw new Error('sid (session ID) claim is required');
    }
    
    logger.debug('Signing new token', { 
      sub: claims.sub,
      sid: claims.sid,
      expiresIn
    });
    
    // Ensure audience is properly formatted
    const audience = options.audience || AUD;
    
    const token = await new SignJWT({
      ...claims,
      // Ensure standard claims are not overridden by custom claims
      iss: undefined,
      aud: undefined,
      exp: undefined,
      iat: undefined,
      jti: undefined,
      nbf: undefined
    })
      .setProtectedHeader({ 
        alg: ALG, 
        typ: 'JWT',
        kid: 'ed25519-2023' // Key ID for key rotation
      })
      .setIssuedAt()
      .setIssuer(options.issuer || 'clerko')
      .setAudience(audience)
      .setExpirationTime(now + expiresIn)
      .setJti(uuidv4())
      .setNotBefore(options.notBefore ? now + options.notBefore : now)
      .sign(privateKey);

    logger.debug('Successfully signed token', { 
      sub: claims.sub,
      sid: claims.sid,
      expiresIn 
    });
    
    return token;
  } catch (error) {
    const errorMessage = 'Failed to sign token';
    logger.error(errorMessage, { 
      error,
      claims: { 
        sub: claims.sub,
        sid: claims.sid
      }
    });
    throw new Error(errorMessage);
  }
}

/**
 * Verifies a Combined Token
 * @param token JWT token to verify
 * @param options Configuration options
 * @returns Decoded and verified token claims
 * @throws {jose.errors.JOSEError} If verification fails
 */
export async function verifyCombinedToken(
  token: string, 
  options: {
    audience?: string | string[];
    issuer?: string;
    clockTolerance?: number; // in seconds
    maxTokenAge?: number;    // in seconds
  } = {}
): Promise<CombinedTokenClaims> {
  try {
    if (!token) {
      throw new JWTVerificationError('Token is required', 'MISSING_TOKEN');
    }
    
    await initializeKeys();
    
    const verifyOptions: JWTVerifyOptions = {
      algorithms: [ALG],
      audience: options.audience || AUD,
      issuer: options.issuer || 'clerko',
      clockTolerance: options.clockTolerance || 30, // 30 seconds leeway for clock skew
    };
    
    if (options.maxTokenAge) {
      verifyOptions.maxTokenAge = `${options.maxTokenAge}s`;
    }
    
    logger.debug('Verifying token', { 
      token: `${token.substring(0, 10)}...`,
      options: verifyOptions
    });
    
    const { payload } = await jwtVerify(token, publicKey, verifyOptions);
    
    // Cast to our extended JWT payload type
    const tokenPayload = payload as JWTPayloadWithClaims;

    // Ensure required claims
    if (!tokenPayload.sub) {
      throw new JWTVerificationError('Missing required claim: sub', 'INVALID_CLAIMS');
    }
    
    if (!tokenPayload.sid) {
      throw new JWTVerificationError('Missing required claim: sid', 'INVALID_CLAIMS');
    }
    
    // Extract claims with proper typing
    const { sub, sid, iss = '', aud, exp = 0, iat = 0, jti = '', gh } = tokenPayload;
    const scope = (['publish', 'api'].includes(tokenPayload.scope as string) 
      ? tokenPayload.scope as 'publish' | 'api' 
      : 'api');
    
    // Create verified claims with proper typing
    const verifiedClaims: CombinedTokenClaims = {
      // Standard claims
      iss: typeof iss === 'string' ? iss : '',
      sub,
      aud: aud || '',
      exp,
      iat,
      jti: jti || '',
      // Custom claims
      sid,
      scope,
      userId: sub,
      sessionId: sid,
      // GitHub context if present
      ...(gh ? { gh } : {})
    };
    
    logger.debug('Successfully verified token', { 
      sub: verifiedClaims.sub,
      sid: verifiedClaims.sid,
      exp: verifiedClaims.exp,
      iat: verifiedClaims.iat
    });
    
    return verifiedClaims;
  } catch (error) {
    const errorMessage = error instanceof JWTVerificationError 
      ? error.message 
      : 'Token verification failed';
      
    const errorCode = error instanceof JWTVerificationError 
      ? error.code 
      : 'VERIFICATION_FAILED';
    
    logger.error(errorMessage, { 
      error,
      code: errorCode,
      token: token ? `${token.substring(0, 10)}...` : 'none'
    });
    
    throw new JWTVerificationError(
      errorMessage,
      errorCode
    );
  }
}

/**
 * Extracts the JWT payload without verification
 * @param token JWT token to decode
 * @returns Decoded token payload (not verified) or null if invalid
 */
export function decodeCombinedToken(token: string): CombinedTokenClaims | null {
  try {
    if (!token) {
      logger.warn('Attempted to decode empty token');
      return null;
    }
    
    // Decode the JWT token
    const { payload } = decodeJwt(token);
    
    // Ensure payload is a non-null object
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      logger.warn('Decoded token payload is not an object', { token: `${token.substring(0, 10)}...` });
      return null;
    }
    
    // Cast to our extended JWT payload type
    const tokenPayload = payload as JWTPayloadWithClaims;
    
    // Extract required claims with type safety
    const { sub, sid } = tokenPayload;
    
    // Ensure required claims exist
    if (!sub || !sid) {
      logger.warn('Decoded token is missing required claims', { 
        hasSub: !!sub,
        hasSid: !!sid,
        token: `${token.substring(0, 10)}...`
      });
      return null;
    }
    
    // Extract optional claims with defaults
    const iss = (tokenPayload.iss as string) || '';
    const aud = tokenPayload.aud || '';
    const exp = (tokenPayload.exp as number) || 0;
    const iat = (tokenPayload.iat as number) || 0;
    const jti = (tokenPayload.jti as string) || '';
    const scope = (['publish', 'api'].includes(tokenPayload.scope as string) 
      ? tokenPayload.scope as 'publish' | 'api' 
      : 'api');
    
    // Create the decoded claims object with proper typing
    const decodedClaims: CombinedTokenClaims = {
      // Standard claims
      iss,
      sub,
      aud,
      exp,
      iat,
      jti,
      // Custom claims
      sid,
      scope,
      userId: sub,
      sessionId: sid,
      // GitHub context if present
      ...(tokenPayload.gh ? { gh: tokenPayload.gh } : {})
    };
    
    logger.debug('Successfully decoded token', { 
      sub: decodedClaims.sub,
      sid: decodedClaims.sid,
      exp: decodedClaims.exp
    });
    
    return decodedClaims;
  } catch (error) {
    logger.error('Failed to decode token', { 
      error,
      token: token ? `${token.substring(0, 10)}...` : 'none'
    });
    return null;
  }
}

/**
 * Checks if a token is expired without verifying the signature
 * @param token JWT token or decoded claims to check
 * @returns True if token is expired or invalid, false otherwise
 */
export function isTokenExpired(token: string | CombinedTokenClaims | null): boolean {
  try {
    let claims: CombinedTokenClaims | null;
    
    if (typeof token === 'string') {
      claims = decodeCombinedToken(token);
    } else {
      claims = token;
    }
    
    // If we can't decode the token or it's missing expiration, consider it expired
    if (!claims || !claims.exp) {
      logger.warn('Token is missing expiration or could not be decoded');
      return true;
    }
    
    const now = Math.floor(Date.now() / 1000);
    const isExpired = claims.exp < now;
    
    if (isExpired) {
      logger.debug('Token is expired', { 
        sub: claims.sub,
        exp: claims.exp,
        now,
        expiredFor: now - claims.exp
      });
    }
    
    return isExpired;
  } catch (error) {
    logger.error('Failed to check token expiration', { error });
    return true;
  }
}
