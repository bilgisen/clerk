import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { clerkMiddleware, auth as clerkAuth } from '@clerk/nextjs/server';
import { authGateway, isAuthenticated } from './middleware/auth-gateway';

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
      const regex = new RegExp(`^/api/books/by-slug/[^/]+/publish$`);
      return regex.test(path);
    } catch (e) {
      console.error(`Invalid route pattern: ${route}`, e);
      return false;
    }
  });
};

// Main middleware function
export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Handle Clerk-only routes
  if (isClerkOnlyRoute(pathname)) {
    try {
      const session = await clerkAuth();
      if (!session?.userId) {
        return new NextResponse('Unauthorized', { status: 401 });
      }
      // Set auth context for Clerk
      request.authContext = {
        authType: 'clerk',
        userId: session.userId,
        sessionId: session.sessionId || undefined,
      };
      return NextResponse.next();
    } catch (error) {
      console.error('Clerk auth failed:', error);
      return new NextResponse('Unauthorized', { status: 401 });
    }
  }

  // Handle API routes with the auth gateway
  if (pathname.startsWith('/api/')) {
    const response = await authGateway(request);
    if (response) {
      return response;
    }
    
    // Ensure the request is authenticated
    if (!isAuthenticated(request)) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    return NextResponse.next();
  }

  // Handle client-side routes with Clerk
  try {
    const { userId } = await clerkAuth();
    if (!userId) {
      const signInUrl = new URL('/sign-in', request.url);
      signInUrl.searchParams.set('redirect_url', pathname);
      return NextResponse.redirect(signInUrl);
    }
    return NextResponse.next();
  } catch (error) {
    console.error('Clerk authentication error:', error);
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('redirect_url', pathname);
    return NextResponse.redirect(signInUrl);
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
    '/',
    '/(api|trpc)(.*)',
  ],
};
