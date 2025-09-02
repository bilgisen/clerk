// lib/auth/edge-auth.ts
import { jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET || 'your-secret-key';
const secret = new TextEncoder().encode(JWT_SECRET);

export interface TokenPayload {
  sub: string;
  email: string;
  name?: string;
  role?: string;
  sessionId?: string;
  exp?: number;
  iat?: number;
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });
    
    // Ensure the payload has the required fields
    if (!payload.sub || !('email' in payload)) {
      throw new Error('Invalid token payload: missing required fields');
    }
    
    return {
      sub: payload.sub,
      email: payload.email as string,
      name: 'name' in payload ? payload.name as string : undefined,
      role: 'role' in payload ? payload.role as string : undefined,
      sessionId: 'sessionId' in payload ? payload.sessionId as string : undefined,
      exp: payload.exp,
      iat: payload.iat
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export async function getAuthToken(): Promise<string | null> {
  const cookieStore = cookies();
  // Check for better-auth session token
  const sessionToken = cookieStore.get('__Secure-auth.session-token') || 
                      cookieStore.get('auth-token');
  
  return sessionToken?.value || null;
}
