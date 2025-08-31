import { clerkMiddleware } from "@clerk/nextjs";
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyGitHubOidcToken } from '@/lib/auth/github-oidc';

// Public routes that don't require authentication
const publicRoutes = [
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/api/trpc(.*)',
  '/_next/static(.*)',
  '/_next/image(.*)',
  '/favicon.ico',
  '/public(.*)',
  '/api/github/oidc',
  '/api/clerk/.*',
  '/api/.*\\.(jpg|jpeg|png|svg|webp|gif|ico|css|js)$',
];

// GitHub OIDC protected routes
const githubOidcRoutes = ['/api/github/oidc'];

// Helper to check if a path matches any of the given patterns
function isPathMatching(path: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
    return regex.test(path);
  });
}

// Create Clerk middleware
const baseClerkMiddleware = clerkMiddleware({
  publicRoutes,
  ignoredRoutes: [
    '/api/webhooks(.*)',
    '/api/trpc(.*)',
    '/api/github/oidc',
    '/_next/static(.*)',
    '/_next/image(.*)',
    '/favicon.ico',
  ],
});

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (isPathMatching(pathname, publicRoutes)) {
    return NextResponse.next();
  }

  // Handle GitHub OIDC routes
  if (isPathMatching(pathname, githubOidcRoutes)) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new NextResponse('Unauthorized - Missing or invalid token', { status: 401 });
    }

    try {
      const token = authHeader.split(' ')[1];
      const result = await verifyGitHubOidcToken(token);

      if (!result.valid) {
        return new NextResponse('Unauthorized - Invalid token', { status: 401 });
      }

      // Add GitHub OIDC claims to request headers
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set('x-github-oidc-claims', JSON.stringify(result.claims));

      return NextResponse.next({
        request: { headers: requestHeaders },
      });
    } catch (error) {
      console.error('GitHub OIDC verification failed:', error);
      return new NextResponse('Internal Server Error', { status: 500 });
    }
  }

  // Default: use Clerk middleware
  return baseClerkMiddleware(req);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
