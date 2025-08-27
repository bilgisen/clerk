import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { verifyGithubOidc } from './lib/auth/github-oidc';
import { verifySecretToken } from './lib/auth/verifySecret';
import { verifyCombinedToken } from './lib/auth/combined';

declare module '@clerk/nextjs/server' {
  interface AuthObject {
    userId: string | null;
    sessionId: string | null;
    getToken: () => Promise<string | null>;
  }
}

// Routes that allow secret token authentication
const SECRET_TOKEN_ROUTES = [
  '/api/debug/(.*)'
];

// Routes that require combined token authentication
const COMBINED_TOKEN_ROUTES = [
  '/api/books/by-id/(.*)/payload',
  '/api/books/by-slug/(.*)/imprint',
  '/api/books/by-slug/(.*)/chapters/(.*)/html',
  '/api/books/by-slug/(.*)/chapters/(.*)/content',
  '/api/books/by-id/(.*)/epub',
  '/api/ci/process',
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
const isProtectedRoute = (request: NextRequest): boolean => {
  const { pathname } = request.nextUrl;
  const combinedTokenRoutes = [
    "/api/publish/status",
    "/api/publish/finalize",
    "/api/books/[id]/epub",
    "/api/ci/process",
  ];

  const secretTokenRoutes = [
    "/api/webhooks/github",
  ];

  const requiresCombinedToken = combinedTokenRoutes.some(route => {
    const routeRegex = new RegExp(`^${route.replace(/\[.*?\]/g, '[^/]+')}(?:/.*)?$`);
    return routeRegex.test(pathname);
  });

  const requiresSecretToken = secretTokenRoutes.some(route => {
    const routeRegex = new RegExp(`^${route.replace(/\[.*?\]/g, '[^/]+')}(?:/.*)?$`);
    return routeRegex.test(pathname);
  });

  return requiresCombinedToken || requiresSecretToken;
};

// Handle secret token authentication for API routes
async function handleSecretTokenAuth(request: NextRequest): Promise<NextResponse | null> {
  const authHeader = request.headers.get('authorization');
  const secretToken = authHeader?.split(' ')[1];

  if (!secretToken) {
    return NextResponse.json(
      { error: 'Missing authorization token' },
      { status: 401 }
    ) as NextResponse<{ error: string }>;
  }

  try {
    const isValid = await verifySecretToken(request);
    if (!isValid) {
      throw new Error('Invalid token');
    }
    return null;
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid or expired token' },
      { status: 403 }
    ) as NextResponse<{ error: string }>;
  }
}

// Handle combined token authentication for API routes
async function handleCombinedTokenAuth(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return NextResponse.json(
      { error: 'Authorization token required' },
      { status: 401 }
    ) as NextResponse<{ error: string }>;
  }

  try {
    await verifyCombinedToken(token);
    return NextResponse.next() as NextResponse;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid or expired token';
    return NextResponse.json(
      { error: errorMessage },
      { status: 403 }
    ) as NextResponse<{ error: string }>;
  }
}

// Handle API authentication based on route
async function handleApiAuth(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;
  
  try {
    // Check for combined token routes
    if (isPathMatching(pathname, COMBINED_TOKEN_ROUTES)) {
      return await handleCombinedTokenAuth(request);
    }
    
    // Fall back to secret token auth for other protected routes
    if (isPathMatching(pathname, SECRET_TOKEN_ROUTES)) {
      const result = await handleSecretTokenAuth(request);
      return result;
    }
    
    // No auth required for this route
    return null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    ) as NextResponse<{ error: string }>;
  }
}

// Custom middleware function
export default async function middleware(req: NextRequest): Promise<NextResponse | void> {
  const { userId } = getAuth(req as any); // Type assertion as a temporary workaround
  
  // Public routes that don't require authentication
  const publicRoutes = ['/api/webhook/clerk', '/api/health', '/sign-in', '/sign-up'];
  
  // Handle API routes
  if (req.nextUrl.pathname.startsWith('/api')) {
    // Skip auth for public API routes
    if (publicRoutes.some(route => req.nextUrl.pathname.startsWith(route))) {
      return NextResponse.next();
    }

    // Handle authentication for protected API routes
    const authResponse = await handleApiAuth(req);
    if (authResponse) {
      return authResponse;
    }
    
    // Default to Clerk auth for other protected routes
    if (!isPathMatching(req.nextUrl.pathname, [...publicRoutes, ...SECRET_TOKEN_ROUTES, ...COMBINED_TOKEN_ROUTES])) {
      if (!userId) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }
    
    return NextResponse.next();
  }
  
  // Handle non-API routes
  if (!userId) {
    // Redirect to sign-in for protected pages
    if (!publicRoutes.includes(req.nextUrl.pathname)) {
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', req.url);
      return NextResponse.redirect(signInUrl);
    }
  } else if (['/sign-in', '/sign-up'].includes(req.nextUrl.pathname)) {
    // Redirect authenticated users away from auth pages
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Check if the route is protected
  if (isProtectedRoute(req) && !publicRoutes.includes(req.nextUrl.pathname)) {
    // If user is not signed in and the route is not public, redirect to sign in
    if (!userId) {
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', req.url);
      return NextResponse.redirect(signInUrl);
    }
  }

  // For all other cases, continue with the request
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sign-in|sign-up).*)',
    '/',
    '/(api|trpc)(.*)',
  ],
};
