// lib/middleware/withAuth.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyGitHubToken, type GitHubAuthContext } from '@/lib/auth/github';
import { verifyClerkToken, type ClerkAuthContext } from '@/lib/auth/clerk';
import { AuthError } from '@/lib/auth/errors';

type AuthContext = (GitHubAuthContext | ClerkAuthContext) & {
  // Common properties that all auth types should have
  type: 'github' | 'clerk';
  userId: string;
  email?: string;
};

// Type guards for different auth contexts
export function isGitHubAuthContext(context: AuthContext): context is GitHubAuthContext {
  return context.type === 'github';
}

export function isClerkAuthContext(context: AuthContext): context is ClerkAuthContext {
  return context.type === 'clerk';
}

// Type guard to check if error is AuthError
function isAuthError(error: unknown): error is AuthError {
  return (
    error instanceof AuthError ||
    (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      'code' in error &&
      'message' in error
    )
  );
}

type Handler = (
  req: NextRequest,
  context: { params: Record<string, string | string[]> },
  auth: AuthContext
) => Promise<NextResponse> | NextResponse | Promise<Response> | Response;

interface WithAuthOptions {
  /**
   * Whether authentication is required (default: true)
   * If false, the handler will still receive auth context if available
   */
  requireAuth?: boolean;
  
  /**
   * Required permissions for the request
   */
  requiredPermissions?: string[];
  
  /**
   * Whether to allow GitHub OIDC tokens (default: true)
   */
  allowGitHubOidc?: boolean;
  
  /**
   * Whether to allow Clerk authentication (default: true)
   */
  allowClerk?: boolean;
}

/**
 * Middleware that adds authentication to API routes
 * @param handler The route handler function
 * @param options Authentication options
 */
export function withAuth(
  handler: Handler,
  options: WithAuthOptions = {}
) {
  const {
    requireAuth = true,
    requiredPermissions = [],
    allowGitHubOidc = true,
    allowClerk = true,
  } = options;

  return async (
    req: NextRequest,
    context: { params: Record<string, string | string[]> }
  ): Promise<Response> => {
    try {
      const authHeader = req.headers.get('authorization');
      let authContext: AuthContext | null = null;

      if (!authHeader) {
        throw new AuthError('No authentication token provided', 'MISSING_TOKEN', 401);
      }

      const token = authHeader.startsWith('Bearer ') ? authHeader.substring('Bearer '.length).trim() : null;

      if (!token) {
        throw new AuthError('No authentication token provided', 'MISSING_TOKEN', 401);
      }

      // Parse token header to determine token type
      const [header] = token.split('.');
      let headerData;
      try {
        headerData = JSON.parse(Buffer.from(header, 'base64').toString());
      } catch {
        throw new AuthError('Invalid token format', 'INVALID_TOKEN', 401);
      }

      // Determine token type
      const isClerkToken = headerData?.kid?.startsWith('ins_');
      const isGitHubToken = headerData?.kid && !headerData.kid.startsWith('ins_');

      // Try Clerk token first if allowed
      if (isClerkToken && (allowClerk ?? true)) {
        try {
          const clerkAuth = await verifyClerkToken(token);
          authContext = {
            ...clerkAuth,
            type: 'clerk',
            userId: clerkAuth.userId,
            email: clerkAuth.email,
          };
        } catch (error) {
          console.error('Clerk verification failed:', error);
          throw new AuthError('Clerk authentication failed', 'CLERK_AUTH_FAILED', 401);
        }
      }
      // Try GitHub token if allowed
      else if (isGitHubToken && allowGitHubOidc) {
        try {
          const githubContext = await verifyGitHubToken(token, {
            audience: process.env.GITHUB_OIDC_AUDIENCE,
            allowedRepo: process.env.GHA_ALLOWED_REPO,
            allowedRef: process.env.GHA_ALLOWED_REF,
            requireWorkflowFromSameRepo: true,
          });
          
          authContext = {
            ...githubContext,
            type: 'github',
            userId: githubContext.claims.sub,
            email: githubContext.claims.email as string | undefined,
          };
        } catch (error) {
          console.error('GitHub verification failed:', error);
          throw new AuthError('GitHub OIDC authentication failed', 'GITHUB_AUTH_FAILED', 401);
        }
      }
      // No valid token type found
      else {
        throw new AuthError('Unsupported token type', 'UNSUPPORTED_TOKEN', 401);
      }

      // At this point, we've either authenticated or thrown an error
      if (!authContext) {
        throw new AuthError(
          'Authentication required',
          'AUTHENTICATION_REQUIRED',
          401,
          { requiredPermissions }
        );
      }

      // Check permissions if required
      if (authContext && requiredPermissions.length > 0) {
        // In a real app, you would check the user's permissions here
        // For now, we'll just log a warning
        console.warn('Permission checks not implemented yet', {
          userId: authContext.userId,
          requiredPermissions,
        });
      }

      // Call the handler with the auth context (or null if no auth required)
      try {
        const response = await handler(req, context, authContext!);
        
        // Ensure CORS headers are set
        if (response instanceof NextResponse || response instanceof Response) {
          const headers = new Headers(response.headers);
          
          // Add security headers
          headers.set('X-Content-Type-Options', 'nosniff');
          headers.set('X-Frame-Options', 'DENY');
          headers.set('X-XSS-Protection', '1; mode=block');
          
          // If it's a NextResponse, we can modify it directly
          if (response instanceof NextResponse) {
            headers.forEach((value, key) => {
              response.headers.set(key, value);
            });
            return response;
          }
          
          // Otherwise, create a new Response with the updated headers
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
          });
        }
        
        return response;
      } catch (error) {
        // If the handler throws an AuthError, let it be handled below
        if (isAuthError(error)) {
          throw error;
        }
        
        // For other errors, log and wrap in an AuthError
        console.error('Error in API handler:', error);
        throw new AuthError(
          'Internal server error',
          'INTERNAL_SERVER_ERROR',
          500,
          { cause: error }
        );
      }
    } catch (error) {
      console.error('Authentication error:', error);
      
      // Handle known error types
      if (isAuthError(error)) {
        const authError = error as AuthError;
        const status = authError.status || 500;
        const responseData = {
          error: authError.message,
          code: authError.code,
          ...(process.env.NODE_ENV === 'development' && {
            details: authError.details,
            stack: error instanceof Error ? error.stack : undefined,
          }),
        };
        
        const headers = new Headers({
          'Content-Type': 'application/json'
        });
        
        if (authError.retryAfter) {
          headers.set('Retry-After', authError.retryAfter.toString());
        }
        
        return new NextResponse(
          JSON.stringify(responseData),
          { 
            status,
            headers
          }
        );
      }
      
      // For unexpected errors, return 500 with minimal details in production
      const responseData = {
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
        ...(process.env.NODE_ENV === 'development' && {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        }),
      };
      
      return new NextResponse(
        JSON.stringify(responseData),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
  };
}

/**
 * Checks if the authenticated user owns a resource
 * @param auth The authentication context
 * @param resourceOwnerId The ID of the resource owner
 * @returns True if the user owns the resource, false otherwise
 */
export async function checkResourceOwnership(
  auth: AuthContext | null,
  resourceOwnerId: string
): Promise<boolean> {
  if (!auth) return false;
  
  try {
    if (isGitHubAuthContext(auth)) {
      // For GitHub actions, we might want to verify the repository has access
      // This is a simplified example - you'd want to implement proper checks
      // based on your security requirements
      return true;
    }
    
    if (isClerkAuthContext(auth)) {
      // For Clerk, check if the authenticated user owns the resource
      return auth.userId === resourceOwnerId;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking resource ownership:', error);
    return false;
  }
}

/**
 * Middleware options that require authentication
 */
export const requireAuth: WithAuthOptions = {
  requireAuth: true,
};

/**
 * Middleware options that allow unauthenticated requests
 */
export const optionalAuth: WithAuthOptions = {
  requireAuth: false,
};
