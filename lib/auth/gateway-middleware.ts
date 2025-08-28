import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { verifyGithubOidc } from './github-oidc';

type AuthContext = {
  authType: 'clerk' | 'github-oidc' | 'unauthorized';
  userId?: string;
  sessionId?: string;
  claims?: Record<string, any>;
};

declare module 'next/server' {
  interface NextRequest {
    authContext?: AuthContext;
  }
}

export async function authGateway(request: NextRequest) {
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
        return NextResponse.next();
      }
    } catch (error) {
      console.error('GitHub OIDC verification failed:', error);
    }
  }

  // Handle Clerk session
  try {
    const session = await auth();
    if (session?.userId) {
      request.authContext = {
        authType: 'clerk',
        userId: session.userId,
        sessionId: session.sessionId || undefined,
      };
      return NextResponse.next();
    }
  } catch (error) {
    console.error('Clerk auth failed:', error);
  }

  // No valid authentication found
  request.authContext = { authType: 'unauthorized' };
  
  // Allow public routes
  const publicRoutes = [
    '/',
    '/api/public/(.*)',
    '/api/trpc/(.*)',
    '/_next/(.*)',
    '/favicon.ico',
    '/sign-in(.*)',
    '/sign-up(.*)',
  ];

  const isPublicRoute = publicRoutes.some(route => 
    new RegExp(`^${route.replace(/\*/g, '.*')}$`).test(request.nextUrl.pathname)
  );

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Return 401 for unauthenticated requests to protected routes
  return new NextResponse('Unauthorized', { status: 401 });
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

// Type guard for Clerk authentication
export function isClerkAuthenticated(
  request: NextRequest
): request is NextRequest & { authContext: { authType: 'clerk' } } {
  return request.authContext?.authType === 'clerk';
}

// Type guard for GitHub OIDC authentication
export function isGithubOidcAuthenticated(
  request: NextRequest
): request is NextRequest & { authContext: { authType: 'github-oidc' } } {
  return request.authContext?.authType === 'github-oidc';
}
