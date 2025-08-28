import { SignJWT, jwtVerify } from 'jose';
import { randomBytes } from 'crypto';

// Get JWT secret from environment variables
const JWT_SECRET = process.env.AUTH_SECRET || 'default-secret';

interface TokenPayload {
  sub: string;
  repository?: string;
  workflow?: string;
  run_id?: string | number;
  [key: string]: any;
}

/**
 * Generate a secure JWT token
 */
export async function generateSecureToken(payload: TokenPayload, expiresIn = '1h'): Promise<string> {
  const secretKey = new TextEncoder().encode(JWT_SECRET);
  
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey);
}

/**
 * Verify a JWT token
 */
export async function verifyToken<T = any>(token: string): Promise<T | null> {
  try {
    const secretKey = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secretKey);
    return payload as T;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Generate a secure random string
 */
export function generateRandomString(length = 32): string {
  return randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}
