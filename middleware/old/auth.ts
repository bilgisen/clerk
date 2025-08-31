import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { verifyGitHubOidcToken } from './github-oidc';
import { AuthType, ClerkAuthContext, GitHubOidcAuthContext, GitHubOidcClaims } from '../../lib/types/auth';

export type AuthContextUnion = ClerkAuthContext | GitHubOidcAuthContext | { type: 'unauthorized' };

// Create an augmented version of NextRequest with our auth context
type AuthenticatedRequest = NextRequest & {
  authContext: AuthContextUnion;
};

// Extend the global Request interface for type safety
declare global {
  // This extends the global Request interface, not NextRequest
  interface Request {
    authContext: AuthContextUnion;
  }
}

type MiddlewareHandler = (
  req: AuthenticatedRequest,
  event: NextFetchEvent
) => Promise<NextResponse> | NextResponse;

type MiddlewareOptions = {
  requireAuth?: boolean;
  allowedAuthTypes?: AuthType[];
};

// Handler type that can optionally receive auth context
export type HandlerWithAuth = (
  req: NextRequest,
  context?: {
    params?: Record<string, string>;
    authContext: AuthContextUnion;
  }
) => Promise<NextResponse>;

// Helper to create consistent error responses
function createErrorResponse(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
): NextResponse {
  return new NextResponse(
    JSON.stringify({
      error: status >= 500 ? 'Internal Server Error' :
             status === 401 ? 'Unauthorized' :
             status === 403 ? 'Forbidden' :
             status === 404 ? 'Not Found' : 'Error',
      code,
      message,
      ...(details ? { details } : {})
    }),
    {
      status,
      headers: { 
        'Content-Type': 'application/json',
        'WWW-Authenticate': `Bearer error="${code}", error_description="${message}"`
      }
    }
  );
}

// Main authentication middleware
export function withAuth(
  handler: HandlerWithAuth,
  options: MiddlewareOptions = {}
): (req: NextRequest, context: { params?: Record<string, string> }) => Promise<NextResponse> {
  return async function(req: NextRequest, context: { params?: Record<string, string> } = { params: {} }) {
    // Cast to our authenticated request type
    const authReq = req as unknown as AuthenticatedRequest;
    const {
      requireAuth = true,
      allowedAuthTypes = ['clerk', 'github-oidc'],
    } = options;

    // Initialize auth context
    authReq.authContext = { type: 'unauthorized' };

    // Handle GitHub OIDC authentication
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const claims = await verifyGitHubOidcToken(token);
        
        if (claims) {
          // Ensure all required fields are present
          if (!claims.sub || !claims.repository || !claims.repository_owner) {
            throw new Error('Invalid GitHub OIDC token: missing required claims');
          }
          
          // Safely cast the claims to the expected type
          const safeClaims = claims as unknown as GitHubOidcClaims;
          
          const githubContext: GitHubOidcAuthContext = {
            type: 'github-oidc',
            userId: safeClaims.sub,
            claims: safeClaims,
            repository: safeClaims.repository,
            repositoryOwner: safeClaims.repository_owner,
            actor: safeClaims.actor,
            ref: safeClaims.ref,
            sha: safeClaims.sha,
            workflow: safeClaims.workflow,
            runId: safeClaims.run_id
          };
          authReq.authContext = githubContext;
          
          // If only GitHub OIDC is allowed, we're done
          if (allowedAuthTypes.includes('github-oidc') && !allowedAuthTypes.includes('clerk')) {
            try {
              return await handler(authReq);
            } catch (error) {
              console.error('Error handling request:', error);
              return createErrorResponse(
                500,
                'INTERNAL_SERVER_ERROR',
                'An internal server error occurred.'
              );
            }
          }
        }
      } catch (error) {
        console.error('GitHub OIDC verification failed:', error);
      }
    }

    // Handle Clerk authentication
    try {
      const session = await auth();
      if (session && session.userId) {
        const user = await currentUser();
        if (user) {
          const clerkContext: ClerkAuthContext = {
            type: 'clerk',
            userId: session.userId,
            email: user.emailAddresses.find((e: { id: string }) => e.id === user.primaryEmailAddressId)?.emailAddress,
            firstName: user.firstName || undefined,
            lastName: user.lastName || undefined,
            imageUrl: user.imageUrl || undefined,
            sessionId: session.sessionId || undefined
          };
          authReq.authContext = clerkContext;
        }
      }
    } catch (error) {
      console.error('Clerk auth failed:', error);
    }

    // Check authentication requirements
    if (requireAuth) {
      // No valid authentication found
      if (!authReq.authContext || (authReq.authContext as { type: string }).type === 'unauthorized') {
        const response = createErrorResponse(
          401,
          'UNAUTHORIZED',
          'Authentication required. Please provide valid credentials.'
        );
        response.headers.set('WWW-Authenticate', 'Bearer realm="api", error="invalid_token"');
        return response;
      }

      // Check if the auth type is allowed
      if (
        authReq.authContext.type !== 'unauthorized' &&
        allowedAuthTypes.length > 0 &&
        !allowedAuthTypes.includes(authReq.authContext.type)
      ) {
        return createErrorResponse(
          403,
          'FORBIDDEN',
          `Authentication method '${authReq.authContext.type}' is not allowed for this endpoint.`
        );
      }
    }

    // Call the handler with the authenticated request and context
    try {
      return await handler(authReq, {
        ...context,
        authContext: authReq.authContext
      });
    } catch (error) {
      console.error('Error handling request:', error);
      return createErrorResponse(
        500,
        'INTERNAL_SERVER_ERROR',
        'An internal server error occurred.'
      );
    }
  };
}

// Helper middleware creators
export function withClerkAuth(handler: HandlerWithAuth) {
  return withAuth(handler, { allowedAuthTypes: ['clerk'] });
}

export function withGithubOidcAuth(handler: HandlerWithAuth) {
  return withAuth(handler, { allowedAuthTypes: ['github-oidc'] });
}

export function withOptionalAuth(handler: HandlerWithAuth) {
  return withAuth(handler, { requireAuth: false });
}

// Helper to get auth context from request
export function getAuthContext(req: NextRequest): AuthContextUnion {
  return (req as unknown as { authContext: AuthContextUnion }).authContext || { type: 'unauthorized' };
}
