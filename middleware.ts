import { auth } from '@clerk/nextjs/server';
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
  '/api/github/oidc'
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
        return new NextResponse('Invalid GitHub OIDC token', { status: 403 });
      }

      return NextResponse.next();
    } catch (err) {
      console.error('GitHub OIDC verification failed:', err);
      return new NextResponse('Unauthorized - Invalid or expired token', { status: 401 });
    }
  }

  // For protected routes, require authentication
  const { userId } = auth();
  if (!userId) {
    // Redirect to sign-in if not authenticated
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('redirect_url', req.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
