import { auth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import { SignJWT, jwtVerify, createRemoteJWKSet } from 'jose';

const LOG_PREFIX = '[Auth]';

export interface JWTPayload {
  userId: string;
  user?: {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  };
  [key: string]: any;
}

interface TokenOptions {
  expiresIn?: string;
  metadata?: Record<string, any>;
}

export async function createToken(userId: string, options: TokenOptions = {}) {
  try {
    const expiresIn = options.expiresIn || '1h';
    const logContext = { userId, expiresIn };
    console.log(`${LOG_PREFIX} Creating token`, logContext);

    // In development, return a mock token if auth is disabled
    if (process.env.NODE_ENV === 'development' && process.env.DISABLE_AUTH === 'true') {
      console.warn(`${LOG_PREFIX} ⚠️ Auth is disabled in development mode`);
      return {
        token: 'dev-token',
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      };
    }

    // In production, use Clerk's session token
    const session = await auth();
    const sessionClaims = session.sessionClaims;
    
    if (!sessionClaims) {
      throw new Error('No active session found');
    }

    // Create a JWT token with the user's session claims and any additional metadata
    const token = await new SignJWT({
      ...sessionClaims,
      ...(options.metadata || {})
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer('clerk.clerko.v1')
      .setAudience('https://api.clerko.com')
      .setExpirationTime(expiresIn)
      .sign(new TextEncoder().encode(process.env.JWT_SECRET || ''));

    return {
      token,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour from now
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} ❌ Error creating token`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

export async function verifyToken(
  token: string,
  options: { operation: string } = { operation: 'verifyToken' }
): Promise<JWTPayload | null> {
  const logContext = { operation: options.operation };
  console.log(`${LOG_PREFIX} Verifying token`, logContext);

  // In development, accept any token if auth is disabled
  if (process.env.NODE_ENV === 'development' && process.env.DISABLE_AUTH === 'true') {
    console.warn(`${LOG_PREFIX} ⚠️ Auth is disabled in development mode`);
    return {
      userId: 'dev-user-id',
      user: {
        id: 'dev-user-id',
        email: 'dev@example.com',
        firstName: 'Development',
        lastName: 'User'
      }
    };
  }

  try {
    // Verify RS256 JWT against Clerk JWKS
    const jwksUrl = process.env.CLERK_JWKS_URL || 'https://sunny-dogfish-14.clerk.accounts.dev/.well-known/jwks.json';
    const issuer = process.env.JWT_ISSUER || 'https://sunny-dogfish-14.clerk.accounts.dev';
    const audience = process.env.JWT_AUDIENCE || 'https://sunny-dogfish-14.clerk.accounts.dev';

    const JWKS = createRemoteJWKSet(new URL(jwksUrl));
    const { payload } = await jwtVerify(token, JWKS, {
      issuer,
      audience,
      algorithms: ['RS256']
    });

    const sub = (payload.sub as string) || '';

    // Map Clerk-style fields if present
    const verified: JWTPayload = {
      userId: sub,
      user: {
        id: sub,
        email: (payload as any).email as string | undefined,
        firstName: (payload as any).first_name || (payload as any).given_name,
        lastName: (payload as any).last_name || (payload as any).family_name,
      },
      ...payload,
    };

    return verified;
  } catch (error) {
    console.error(`${LOG_PREFIX} ❌ JWT verification failed`, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}
