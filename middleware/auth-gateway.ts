import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth as clerkAuth } from '@clerk/nextjs/server';
import { verifyGithubOidc } from '@/lib/auth/github-oidc';

// Auth gateway function that can be used in middleware
export async function authGateway(request: NextRequest): Promise<NextResponse | void> {
  const authorization = request.headers.get('authorization');
  
  // Handle GitHub OIDC token
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.split(' ')[1];
    try {
      const claims = await verifyGithubOidc(token);
      if (claims) {
        request.authContext = {
          authType: 'github-oidc',
          userId: claims.sub,
          claims,
        };
        return;
      }
    } catch (error) {
      console.error('GitHub OIDC verification failed:', error);
    }
  }

  // Handle Clerk session
  try {
    const session = await clerkAuth();
    if (session?.userId) {
      request.authContext = {
        authType: 'clerk',
        userId: session.userId,
        sessionId: session.sessionId || undefined,
      };
      return;
    }
  } catch (error) {
    console.error('Clerk auth failed:', error);
  }

  // No valid authentication found
  request.authContext = { authType: 'unauthorized' };
  
  // Return 401 for unauthenticated requests to protected routes
  return NextResponse.json(
    { error: 'Unauthorized', code: 'UNAUTHORIZED' },
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  );
}

// Type guard for authenticated requests
export function isAuthenticated(
  request: NextRequest
): request is NextRequest & { authContext: { authType: 'clerk' | 'github-oidc' } } {
  return (
    !!request.authContext && 
    request.authContext.authType !== 'unauthorized' &&
    !!request.authContext.userId
  );
}

export async function withAuthGateway(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: {
    requireAuth?: boolean;
    allowedAuthTypes?: ('clerk' | 'github-oidc')[];
  } = {}
) {
  const {
    requireAuth = true,
    allowedAuthTypes = ['clerk', 'github-oidc'],
  } = options;

  return async function (request: NextRequest) {
    // Run the auth gateway
    const response = await authGateway(request);
    
    // If auth gateway returned a response (like 401), return it
    if (response) {
      return response;
    }

    // Check if authentication is required
    if (requireAuth) {
      if (!isAuthenticated(request)) {
        return new NextResponse('Unauthorized', { status: 401 });
      }

      // Check if the auth type is allowed
      if (
        allowedAuthTypes.length > 0 &&
        !allowedAuthTypes.includes(request.authContext!.authType as any)
      ) {
        return new NextResponse('Forbidden: Unauthorized authentication method', {
          status: 403,
        });
      }
    }

    // Proceed to the route handler
    return handler(request);
  };
}

// Helper middleware for Clerk-only routes
export function withClerkAuth(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return withAuthGateway(handler, {
    requireAuth: true,
    allowedAuthTypes: ['clerk'],
  });
}

// Helper middleware for GitHub OIDC-only routes
export function withGithubOidcAuth(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return withAuthGateway(handler, {
    requireAuth: true,
    allowedAuthTypes: ['github-oidc'],
  });
}

// Helper for public routes that still want auth context
export function withOptionalAuth(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return withAuthGateway(handler, { requireAuth: false });
}
