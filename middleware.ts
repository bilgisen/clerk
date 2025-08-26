import { NextResponse, type NextRequest } from 'next/server';
import { verifySecretToken } from '@/lib/auth/verifySecret';

// Routes that allow secret token authentication
const SECRET_TOKEN_ROUTES = [
  '/api/books/by-id/(.*)/payload',
  '/api/books/by-slug/(.*)/imprint',
  '/api/books/by-slug/(.*)/chapters/(.*)/html',
  '/api/books/by-slug/(.*)/chapters/(.*)/content',
  '/api/books/by-id/(.*)/epub',
  '/api/ci/process',
  '/api/debug/(.*)',
];

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/api/public/(.*)',
  '/api/trpc/(.*)',
  '/_next/(.*)',
  '/favicon.ico',
];

// Check if path matches any of the patterns
const isPathMatching = (path: string, patterns: string[]): boolean => {
  return patterns.some(pattern => {
    const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
    return regex.test(path);
  });
};

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth for public routes
  if (isPathMatching(pathname, PUBLIC_ROUTES)) {
    return NextResponse.next();
  }

  // Check for secret token on allowed routes
  if (isPathMatching(pathname, SECRET_TOKEN_ROUTES)) {
    return verifySecretToken(request).then(isValid => {
      if (isValid) {
        return NextResponse.next();
      }
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized', message: 'Invalid or missing secret token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    });
  }

  // For all other routes, redirect to sign-in
  const signInUrl = new URL('/sign-in', request.url);
  signInUrl.searchParams.set('redirect_url', request.url);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sign-in).*)',
    '/trpc/(.*)',
  ],
};
