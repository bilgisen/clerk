import { auth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';

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

export async function createToken(userId: string, options: { expiresIn?: string } = {}) {
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
    const { getToken } = auth();
    const token = await getToken();
    
    if (!token) {
      throw new Error('Failed to create session token');
    }

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
  const logContext = {
    operation: options.operation,
    token: token ? `${token.substring(0, 10)}...` : 'undefined',
    env: {
      NODE_ENV: process.env.NODE_ENV,
    },
  };

  if (!token) {
    console.error(`${LOG_PREFIX} ❌ No token provided`, logContext);
    return null;
  }

  // Skip verification in development if DISABLE_AUTH is set
  if (process.env.NODE_ENV === 'development' && process.env.DISABLE_AUTH === 'true') {
    console.warn(`${LOG_PREFIX} ⚠️ Auth is disabled in development mode`, logContext);
    return {
      userId: 'dev-user-id',
      user: {
        id: 'dev-user-id',
        email: 'dev@example.com',
      },
    };
  }

  try {
    console.log(`${LOG_PREFIX} 🔍 Verifying Clerk session token`, logContext);
    
    // Use Clerk's auth() to verify the session
    const session = await auth();
    
    if (!session || !session.userId) {
      console.error(`${LOG_PREFIX} ❌ No active session found`, logContext);
      return null;
    }
    
    // Get the user object from the session
    const user = session.user;
    
    // Log successful verification
    console.log(`${LOG_PREFIX} ✅ Session verified successfully`, {
      ...logContext,
      userId: session.userId,
      sessionId: session.sessionId,
    });

    return {
      userId: session.userId,
      user: {
        id: session.userId,
        email: user?.emailAddresses?.[0]?.emailAddress,
        firstName: user?.firstName,
        lastName: user?.lastName,
      },
      // Include any additional session data you need
      ...session,
    } as JWTPayload;
    
  } catch (error) {
    console.error(`${LOG_PREFIX} ❌ Error verifying session`, {
      ...logContext,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}
