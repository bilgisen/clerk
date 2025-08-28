import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { authGateway } from './middleware/auth-gateway';

declare module 'next/server' {
  interface NextRequest {
    authContext?: {
      authType: 'clerk' | 'github-oidc' | 'unauthorized';
      userId?: string;
      sessionId?: string;
      claims?: Record<string, any>;
    };
  }
}

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/api/public/(.*)',
  '/api/trpc/(.*)',
  '/_next/(.*)',
  '/favicon.ico',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhook(.*)',
  '/api/health',
  '/api/publish/status(.*)',
];

// Routes that should only use Clerk auth
const CLERK_ONLY_ROUTES = [
  '/api/books/by-slug/[^/]+/publish',
];

// Check if a path is a public route
const isPublicRoute = (path: string): boolean => {
  return PUBLIC_ROUTES.some(route => {
    try {
      const regex = new RegExp(`^${route.replace(/\*\*$/, '.*')}$`);
      return regex.test(path);
    } catch (e) {
      console.error(`Invalid public route pattern: ${route}`, e);
      return false;
    }
  });
};

// Check if a path requires authentication
const requiresAuth = (path: string): boolean => {
  // All API routes except public ones require auth
  return path.startsWith('/api/') && !isPublicRoute(path);
};

// Check if a path should use Clerk auth only
const isClerkOnlyRoute = (path: string): boolean => {
  return CLERK_ONLY_ROUTES.some(route => {
    try {
      const regex = new RegExp(`^${route.replace(/\[\^\/\]\+/g, '([^/]+)')}$`);
      return regex.test(path);
    } catch (e) {
      console.error(`Invalid Clerk-only route pattern: ${route}`, e);
      return false;
    }
  });
};

// Main middleware function
export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;

  // Skip public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Handle API routes with auth gateway
  if (pathname.startsWith('/api/')) {
    // For Clerk-only routes, use Clerk's auth
    if (isClerkOnlyRoute(pathname)) {
      const session = await auth();
      if (!session.userId) {
        return NextResponse.json(
          { error: 'Unauthorized', code: 'UNAUTHORIZED' },
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return NextResponse.next();
    }

    // For other API routes, use our auth gateway
    const response = await authGateway(req);
    if (response) {
      // Ensure all error responses are JSON
      if (response.status >= 400 && !response.headers.get('Content-Type')?.includes('application/json')) {
        const text = await response.text();
        return NextResponse.json(
          { error: text || 'Unauthorized', code: 'UNAUTHORIZED' },
          { status: response.status, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return response;
    }
    
    return NextResponse.next();
  }

  // For non-API routes, use Clerk's auth
  const session = await auth();
  if (!session.userId) {
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('redirect_url', pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
    '/',
    '/(api|trpc)(.*)',
  ],
};
