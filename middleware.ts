import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from './lib/auth/better-auth';
import { getAuth } from './lib/auth/better-auth';

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

  try {
    // Verify the user's session
    const authResult = await getAuth();
    let userRole = 'user';
    
    if (authResult?.user) {
      // User is authenticated, set the user role
      userRole = authResult.user.role || 'user';
    } else {
      // Not authenticated, redirect to sign-in
      const signInUrl = new URL('/signin', request.url);
      signInUrl.searchParams.set('redirect', pathname);
      
      const response = NextResponse.redirect(signInUrl);
      // Clear any invalid session cookie
      response.cookies.delete('auth-session');
      return response;
    }
    
    // Check admin access for admin routes
    if (pathname.startsWith('/admin') && userRole !== 'admin') {
      const signInUrl = new URL('/signin', request.url);
      const response = NextResponse.redirect(signInUrl);
      response.cookies.delete('auth-session');
      return response;
    }

    // Add user info to request headers for API routes
    if (pathname.startsWith('/api/')) {
      const requestHeaders = new Headers(request.headers);
      
      if (authResult?.user) {
        requestHeaders.set('x-user-id', authResult.user.id);
        requestHeaders.set('x-user-email', authResult.user.email || '');
        requestHeaders.set('x-user-role', authResult.user.role || 'user');
      }

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
