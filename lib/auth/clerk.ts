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
  createdAt: number;
  updatedAt: number;
}

interface ClerkSession {
  userId: string;
  sessionClaims?: {
    sid?: string;
    [key: string]: unknown;
  };
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
    // If token is provided, verify it using Clerk's API
    if (token) {
      try {
        // Verify the token using Clerk's API
        const response = await fetch('https://api.clerk.dev/v1/tokens/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`
          },
          body: JSON.stringify({
            token,
            audience: getJwtAudience(),
            issuer: getJwtIssuer()
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to verify token');
        }

        const { session: sessionData } = await response.json();
        const session = sessionData as unknown as ClerkSession;
        
        if (!session?.userId) {
          throw new AuthError(
            'Invalid Clerk token',
            'INVALID_TOKEN',
            401
          );
        }
        
        // Get the current user with proper typing
        const user = await currentUser() as unknown as ClerkUser | null;
        
        if (!user) {
          throw new AuthError(
            'User not found',
            'USER_NOT_FOUND',
            404
          );
        }
        
        // Get the primary email with proper type checking
        const primaryEmail = user.emailAddresses?.find(
          (email: { id: string; emailAddress: string }) => 
            email.id === user.primaryEmailAddressId
        )?.emailAddress || undefined;
        
        // Get the session ID from the session claims
        const sessionId = session.sessionClaims?.sid as string | undefined;
        
        return {
          type: 'clerk',
          userId: user.id,
          email: primaryEmail,
          firstName: user.firstName || undefined,
          lastName: user.lastName || undefined,
          imageUrl: user.imageUrl || undefined,
          sessionId: sessionId,
          sessionClaims: {
            ...session.sessionClaims,
            email: primaryEmail,
            firstName: user.firstName,
            lastName: user.lastName,
            imageUrl: user.imageUrl,
            username: user.username
          }
        };
        
      } catch (error: any) {
        console.error('Clerk token verification error:', error);
        throw new AuthError(
          'Failed to verify Clerk token: ' + (error.message || 'Unknown error'),
          'TOKEN_VERIFICATION_FAILED',
          401,
          { cause: error }
        );
      }
    }
    
    // If no token is provided, use the current session
    const session = await auth();
    
    if (!session?.userId) {
      throw new AuthError(
        'No active Clerk session found',
        'UNAUTHORIZED',
        401
      );
    }

    try {
      // Get user details with proper typing
      const user = await currentUser() as unknown as ClerkUser | null;
      
      if (!user) {
        throw new AuthError(
          'User not found in Clerk',
          'USER_NOT_FOUND',
          404
        );
      }

      // Get the primary email with proper type checking
      const email = user.emailAddresses.find(
        (email: ClerkEmailAddress) => 
          email.id === user.primaryEmailAddressId
      )?.emailAddress;

      // Get the active session ID
      const sessionId = session.sessionClaims?.sid as string | undefined;

      return {
        type: 'clerk',
        userId: session.userId,
        email,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        imageUrl: user.imageUrl || undefined,
        sessionId,
        sessionClaims: {
          ...session.sessionClaims,
          email,
          firstName: user.firstName,
          lastName: user.lastName,
          imageUrl: user.imageUrl,
          username: user.username
        }
      };
    } catch (error: any) {
      console.error('Failed to get user details:', error);
      throw new AuthError(
        'Failed to get user details: ' + (error.message || 'Unknown error'),
        'USER_DETAILS_ERROR',
        500,
        { cause: error }
      );
    }
  } catch (error) {
    if (error instanceof AuthError) throw error;
    
    // Handle Clerk-specific errors
    if (error && typeof error === 'object' && 'message' in error) {
      const err = error as { message: string; status?: number };
      throw new AuthError(
        `Clerk authentication failed: ${err.message}`,
        'CLERK_AUTH_ERROR',
        err.status || 401,
        { cause: error }
      );
    }
    
    throw new AuthError(
      'Failed to verify Clerk session',
      'AUTH_ERROR',
      500,
      { cause: error }
    );
  }
}

/**
 * Checks if a user has access to a resource
 * @param userId The ID of the user to check
 * @param resourceOwnerId The ID of the resource owner
 * @returns True if the user has access, false otherwise
 */
export async function checkResourceAccess(
  userId: string, 
  resourceOwnerId: string
): Promise<boolean> {
  try {
    if (!userId || !resourceOwnerId) {
      throw new AuthError(
        'User ID and resource owner ID are required',
        'INVALID_INPUT',
        400
      );
    }
    
    // In a real application, you might want to implement more complex
    // access control logic here, such as checking roles or permissions
    return userId === resourceOwnerId;
  } catch (error) {
    if (error instanceof AuthError) throw error;
    
    throw new AuthError(
      'Failed to check resource access',
      'AUTH_ERROR',
      500,
      { cause: error }
    );
  }
}

/**
 * Gets the Clerk JWT issuer from environment configuration
 * @returns The JWT issuer URL
 */
export function getJwtIssuer(): string {
  return process.env.JWT_ISSUER || 'clerk.clerko.v1';
}

/**
 * Gets the JWT audience from environment configuration
 * @returns The JWT audience
 */
export function getJwtAudience(): string {
  return process.env.JWT_AUDIENCE || 'https://api.clerko.com';
}
