import { auth } from '@clerk/nextjs/server';

const LOG_PREFIX = '[Auth]';

export interface UserSession {
  userId: string;
  user?: {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  };
}

export async function getCurrentUser(): Promise<UserSession | null> {
  try {
    // In development, return a mock user if auth is disabled
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

    // Get the current session from Clerk
    const session = await auth();
    
    if (!session?.userId) {
      console.log(`${LOG_PREFIX} No active session found`);
      return null;
    }

    return {
      userId: session.userId,
      user: {
        id: session.userId,
        email: session.sessionClaims?.email as string | undefined,
        firstName: session.sessionClaims?.firstName as string | undefined,
        lastName: session.sessionClaims?.lastName as string | undefined
      }
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} ❌ Error getting current user`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}
