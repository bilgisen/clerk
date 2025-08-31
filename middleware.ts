import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from './lib/auth/better-auth';

// Public routes that don't require authentication
const publicRoutes = [
  '/',
  '/signin',
  '/api/auth',
  '/_next',
  '/favicon.ico',
  '/public',
  '/api/.*\.(jpg|jpeg|png|svg|webp|gif|ico|css|js)$',
];

// Protected routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/books',
  '/api/books',
  '/api/user',
];

// Check if a path matches any of the patterns
const isPathMatching = (path: string, patterns: string[]): boolean => {
  return patterns.some(pattern => {
    if (pattern.endsWith('*')) {
      return path.startsWith(pattern.slice(0, -1));
    }
    if (pattern.startsWith('*') && pattern.endsWith('*')) {
      return path.includes(pattern.slice(1, -1));
    }
    return path === pattern;
  });
};

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for public routes
  if (isPathMatching(pathname, publicRoutes)) {
    return NextResponse.next();
  }

  // Skip middleware for non-protected routes
  if (!isPathMatching(pathname, protectedRoutes)) {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionCookie = request.cookies.get('auth-session');

  if (!sessionCookie?.value) {
    // No session cookie found, redirect to sign-in
    const signInUrl = new URL('/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  try {
    // Verify the session token
    const headers = new Headers();
    headers.append('cookie', `auth-session=${sessionCookie.value}`);
    
    const session = await auth.api.getSession({ headers });

    if (!session?.user) {
      // Invalid or expired session, redirect to sign-in
      const signInUrl = new URL('/signin', request.url);
      signInUrl.searchParams.set('callbackUrl', pathname);
      signInUrl.searchParams.set('error', 'session_expired');

      const response = NextResponse.redirect(signInUrl);
      // Clear the invalid session cookie
      response.cookies.delete('auth-session');
      return response;
    }

    // Add user info to request headers for API routes
    if (pathname.startsWith('/api/')) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', session.user.id);
      requestHeaders.set('x-user-email', session.user.email || '');
      requestHeaders.set('x-user-role', (session.user as any).role || 'user');

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Error verifying session:', error);
    
    // Error verifying session, redirect to sign-in
    const signInUrl = new URL('/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    signInUrl.searchParams.set('error', 'session_error');
    
    const response = NextResponse.redirect(signInUrl);
    // Clear the invalid session cookie
    response.cookies.delete('auth-session');
    return response;
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
