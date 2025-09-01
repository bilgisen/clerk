// lib/auth/edge-auth.ts
import { jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.AUTH_SECRET || 'your-secret-key';
const secret = new TextEncoder().encode(JWT_SECRET);

export interface TokenPayload {
  userId: string;
  email: string;
  role?: string;
  sessionId?: string;
  exp?: number;
}

function mapToTokenPayload(jwt: JWTPayload): TokenPayload {
  // Safely extract required fields with type checking
  if (typeof jwt.sub !== 'string' || typeof jwt.email !== 'string') {
    throw new Error('Invalid token payload: missing required fields');
  }
  
  const result: TokenPayload = {
    userId: jwt.sub,
    email: jwt.email
  };
  
  // Add optional fields with type checking
  if (jwt.role && typeof jwt.role === 'string') {
    result.role = jwt.role;
  }
  
  if (jwt.sessionId && typeof jwt.sessionId === 'string') {
    result.sessionId = jwt.sessionId;
  }
  
  if (jwt.exp && typeof jwt.exp === 'number') {
    result.exp = jwt.exp;
  }
  
  return result;
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });
    return mapToTokenPayload(payload);
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export async function getAuthToken(): Promise<string | null> {
  const cookieStore = cookies();
  return cookieStore.get('auth-token')?.value || null;
}
