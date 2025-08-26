import { NextResponse, type NextRequest } from 'next/server';
import { verifySecretToken } from '@/lib/auth/verifySecret';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

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
  '/',
  '/api/public/(.*)',
  '/api/trpc/(.*)',
  '/_next/(.*)',
  '/favicon.ico',
  '/sign-in(.*)',
  '/sign-up(.*)',
];

// Check if path matches any of the patterns
const isPathMatching = (path: string, patterns: string[]): boolean => {
  return patterns.some(pattern => {
    const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
    return regex.test(path);
  });
};

// Create a matcher for protected routes
const isProtectedRoute = createRouteMatcher([
  '/((?!_next/static|_next/image|favicon.ico|sign-in|sign-up).*)',
  '/(api|trpc)(.*)',
]);

// Handle secret token authentication for API routes
async function handleApiAuth(request: NextRequest) {
  if (isPathMatching(request.nextUrl.pathname, SECRET_TOKEN_ROUTES)) {
    const isValid = await verifySecretToken(request);
    if (!isValid) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized', message: 'Invalid or missing secret token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return NextResponse.next();
  }
  return null;
}

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;

  // Handle API routes with secret token authentication
  if (pathname.startsWith('/api/')) {
    const response = await handleApiAuth(req);
    if (response) return response;
  }

  // Skip auth for public routes
  if (isPathMatching(pathname, PUBLIC_ROUTES)) {
    return NextResponse.next();
  }

  // Check if the route is protected
  if (isProtectedRoute(req)) {
    // Get auth state and check if user is authenticated
    const session = await auth();
    if (!session?.userId) {
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', req.url);
      return NextResponse.redirect(signInUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sign-in|sign-up).*)',
    '/',
    '/(api|trpc)(.*)',
  ],
};
