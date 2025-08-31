import { jwtVerify, createRemoteJWKSet } from 'jose';
import { NextRequest } from 'next/server';

const JWKS_URI = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/jwks`;

// Create a remote JWKS set for token verification
const JWKS = createRemoteJWKSet(new URL(JWKS_URI));

interface JWTUser {
  id: string;
  email: string;
  name: string;
  role?: string;
  image?: string | null;
}

/**
 * Verifies a JWT token from the Authorization header
 * @param req NextRequest object containing the request
 * @returns The decoded JWT payload or null if verification fails
 */
export async function verifyJWT(req: NextRequest): Promise<JWTUser | null> {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.split(' ')[1];
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      audience: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    });

    // Safely cast the payload to JWTUser with required fields
    if (payload && typeof payload === 'object' && 'id' in payload && 'email' in payload && 'name' in payload) {
      return {
        id: String(payload.id),
        email: String(payload.email),
        name: String(payload.name),
        role: 'role' in payload ? String(payload.role) : 'user',
        image: 'image' in payload ? String(payload.image) : null
      };
    }
    
    return null;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Gets a JWT token for the current session
 * @returns The JWT token or null if not available
 */
export async function getSessionToken(): Promise<string | null> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/token`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return null;

    const { token } = await response.json();
    return token || null;
  } catch (error) {
    console.error('Failed to get session token:', error);
    return null;
  }
}
