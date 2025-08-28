import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';
import { withAuth, withClerkAuth, withGithubOidcAuth } from './middleware/auth';

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/api/public/(.*)',
  '/api/auth/(.*)',
  '/api/webhooks/(.*)',
  '/api/trpc/(.*)',
  '/_next/(.*)',
  '/favicon.ico',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhook(.*)',
  '/api/health',
  '/api/publish/status(.*)',
];

// Clerk-only routes (require Clerk session)
const CLERK_ONLY_ROUTES = [
  '/dashboard(.*)',
  '/api/user(.*)',
  '/api/account(.*)',
  '/api/books(.*)',
];

// GitHub OIDC only routes (for GitHub Actions)
const GITHUB_OIDC_ROUTES = [
  '/api/publish/attest',
  '/api/publish/combined',
];

// Simple route matcher
const matchesRoute = (path: string, patterns: string[]): boolean => {
  return patterns.some(pattern => {
    if (pattern.endsWith('(.*)')) {
      const base = pattern.replace('(.*)', '');
      return path.startsWith(base);
    }
    return path === pattern;
  });
};

// Handler for public routes
const publicHandler = async (req: NextRequest): Promise<NextResponse> => {
  return NextResponse.next();
};

// Handler for Clerk authenticated routes
const clerkHandler = (req: NextRequest): Promise<NextResponse> => {
  return withClerkAuth(async (req: NextRequest) => {
    return NextResponse.next();
  })(req);
};

// Handler for GitHub OIDC routes
const githubOidcHandler = (req: NextRequest): Promise<NextResponse> => {
  return withGithubOidcAuth(async (req: NextRequest) => {
    return NextResponse.next();
  })(req);
};

// Main middleware
export default withAuth(
  (req: NextRequest) => ({
    // Handler function that will be called after authentication
    async handler(req: NextRequest) {
      const { pathname } = req.nextUrl;
      
      // Handle public routes
      if (matchesRoute(pathname, PUBLIC_ROUTES)) {
        return await publicHandler(req);
      }
      
      // Handle Clerk-only routes
      if (matchesRoute(pathname, CLERK_ONLY_ROUTES)) {
        return await clerkHandler(req);
      }
      
      // Handle GitHub OIDC routes
      if (matchesRoute(pathname, GITHUB_OIDC_ROUTES)) {
        return await githubOidcHandler(req);
      }
      
      // Continue with the request for all other routes
      return NextResponse.next();
    }
  }),
  {
    // Default options for all routes
    requireAuth: true,
    allowedAuthTypes: ['clerk', 'github-oidc']
  }
);

// Configure which routes to run middleware on
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
