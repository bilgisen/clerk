// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuthToken, verifyToken } from '@/lib/auth/edge-auth';

// Public routes - these don't require authentication
const publicRoutes = [
  '/',
  '/signin',
  '/signup',
  '/api/auth',
  '/_next',
  '/favicon.ico',
  '/public',
  '/api/.*\\.(jpg|jpeg|png|svg|webp|gif|ico|css|js)$',
  '/auth/.*',
  '/api/auth/.*',
];

// Protected routes - these require authentication
const protectedRoutes = [
  '/dashboard',
  '/dashboard/.*',
  '/api/books',
  '/api/user',
  '/api/private',
  '/api/books/.*',
];

const isPathMatching = (path: string, patterns: string[]): boolean => {
  return patterns.some((pattern) => {
    if (pattern.endsWith('*')) {
      return path.startsWith(pattern.slice(0, -1));
    }
    if (pattern.endsWith('.*')) {
      const basePattern = pattern.slice(0, -2);
      return path.startsWith(basePattern);
    }
    return path === pattern || new RegExp(`^${pattern}$`).test(path);
  });
};

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith('/api/');

  // Skip for public routes
  if (isPathMatching(pathname, publicRoutes)) {
    return NextResponse.next();
  }

  // Skip for non-protected routes
  if (!isPathMatching(pathname, protectedRoutes)) {
    return NextResponse.next();
  }

  try {
    const token = await getAuthToken();

    if (!token) {
      if (isApiRoute) {
        return new NextResponse(
          JSON.stringify({ error: 'Authentication required' }), 
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // Redirect to sign-in for non-API routes
      const signInUrl = new URL('/signin', request.url);
      signInUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
      return NextResponse.redirect(signInUrl);
    }

    // Verify the token
    const payload = await verifyToken(token);
    if (!payload) {
      if (isApiRoute) {
        return new NextResponse(
          JSON.stringify({ error: 'Invalid or expired session' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // Redirect to sign-in with error for non-API routes
      const signInUrl = new URL('/signin', request.url);
      signInUrl.searchParams.set('error', 'SessionExpired');
      signInUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
      
      // Clear invalid token
      const response = NextResponse.redirect(signInUrl);
      response.cookies.delete('auth-token');
      return response;
    }

    // Add user info to request headers for API routes
    if (isApiRoute) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', payload.sub);
      requestHeaders.set('x-user-email', payload.email);
      if (payload.role) {
        requestHeaders.set('x-user-role', payload.role);
      }

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (isApiRoute) {
      return new NextResponse(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Redirect to sign-in with error for non-API routes
    const signInUrl = new URL('/signin', request.url);
    signInUrl.searchParams.set('error', 'InternalError');
    signInUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
    
    // Clear any invalid token
    const response = NextResponse.redirect(signInUrl);
    response.cookies.delete('auth-token');
    return response;
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
