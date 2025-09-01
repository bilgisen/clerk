// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuthToken, verifyToken } from '@/lib/auth/edge-auth';

// Public routes
const publicRoutes = [
  '/',
  '/sign-in',
  '/api/auth',
  '/_next',
  '/favicon.ico',
  '/public',
  '/api/.*\\.(jpg|jpeg|png|svg|webp|gif|ico|css|js)$',
  '/auth/.*',
];

// Protected routes
const protectedRoutes = ['/dashboard', '/books', '/api/books', '/api/user', '/api/private'];

const isPathMatching = (path: string, patterns: string[]): boolean => {
  return patterns.some((pattern) => {
    if (pattern.endsWith('*')) {
      return path.startsWith(pattern.slice(0, -1));
    }
    return path === pattern || new RegExp(`^${pattern}$`).test(path);
  });
};

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip for public
  if (isPathMatching(pathname, publicRoutes)) {
    return NextResponse.next();
  }

  // Skip for non-protected
  if (!isPathMatching(pathname, protectedRoutes)) {
    return NextResponse.next();
  }

  try {
    const token = await getAuthToken();

    if (!token) {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const signInUrl = new URL('/sign-in', request.url);
      signInUrl.searchParams.set('callbackUrl', request.url);
      return NextResponse.redirect(signInUrl);
    }

    const payload = await verifyToken(token);
    if (!payload) {
      const signInUrl = new URL('/sign-in', request.url);
      signInUrl.searchParams.set('error', 'invalid_token');
      const response = NextResponse.redirect(signInUrl);
      response.cookies.delete('auth-token');
      return response;
    }

    if (pathname.startsWith('/api/')) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', payload.userId);
      requestHeaders.set('x-user-email', payload.email || '');
      requestHeaders.set('x-user-role', payload.role || 'user');

      return NextResponse.next({
        request: { headers: requestHeaders },
      });
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Error in middleware auth:', error);
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('error', 'session_error');
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
