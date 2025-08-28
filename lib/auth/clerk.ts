// lib/auth/clerk.ts
import { auth, currentUser } from '@clerk/nextjs/server';
import { AuthError } from './errors';

// Define types for Clerk objects
interface ClerkEmailAddress {
  id: string;
  emailAddress: string;
}

interface ClerkUser {
  id: string;
  emailAddresses: ClerkEmailAddress[];
  primaryEmailAddressId: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  username: string | null;
}

export interface ClerkAuthContext {
  type: 'clerk';
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  sessionId?: string;
  sessionClaims?: Record<string, unknown>;
}

/**
 * Verifies a Clerk session and returns the authentication context
 * @param token Optional JWT token to verify. If not provided, uses the current session.
 */
export async function verifyClerkToken(token?: string): Promise<ClerkAuthContext> {
  try {
    // If no token is provided, use the current session
    const session = auth();
    const user = await currentUser();
    
    if (!session.userId || !user) {
      throw new AuthError('Not authenticated', 'NOT_AUTHENTICATED', 401);
    }
    
    return {
      type: 'clerk',
      userId: user.id,
      email: user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      imageUrl: user.imageUrl || undefined,
      sessionId: session.sessionClaims?.sid as string | undefined,
      sessionClaims: session.sessionClaims
    };
    
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    
    throw new AuthError(
      'Authentication failed', 
      'AUTHENTICATION_FAILED', 
      500,
      { cause: error }
    );
  }
}

/**
 * Gets the current user's auth context
 */
export async function getAuthContext(): Promise<ClerkAuthContext> {
  return verifyClerkToken();
}

/**
 * Middleware to protect routes with Clerk authentication
 */
export function withClerkAuth(handler: (req: Request, ctx: ClerkAuthContext) => Promise<Response>) {
  return async (req: Request) => {
    try {
      const authContext = await getAuthContext();
      return handler(req, authContext);
    } catch (error) {
      if (error instanceof AuthError) {
        return new Response(
          JSON.stringify({ 
            error: error.message,
            code: error.code 
          }), 
          { 
            status: error.status,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      console.error('Authentication error:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Internal server error',
          code: 'INTERNAL_SERVER_ERROR' 
        }), 
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  };
}
