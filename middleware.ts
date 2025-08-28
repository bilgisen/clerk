import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyGitHubOidcToken } from './middleware/github-oidc';

// Public routes that don't require authentication
const publicRoutes = [
  '/',
  '/api/public/(.*)',
  '/api/auth/(.*)',
  '/_next/(.*)',
  '/favicon.ico',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/health',
];

// GitHub OIDC protected routes
const githubOidcRoutes = [
  '/api/publish/attest',
  '/api/publish/combined',
];

// Helper to check if a path matches any of the given patterns
function isPathMatching(path: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
    return regex.test(path);
  });
}

export default clerkMiddleware(async (auth, request: NextRequest) => {
  const { pathname } = request.nextUrl;
  
  // Skip public routes
  if (isPathMatching(pathname, publicRoutes)) {
    return NextResponse.next();
  }

  // Handle GitHub OIDC routes
  if (isPathMatching(pathname, githubOidcRoutes)) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new NextResponse('Unauthorized - Missing or invalid token', { status: 401 });
    }
    
    try {
      await verifyGitHubOidcToken(authHeader.split(' ')[1]);
      return NextResponse.next();
    } catch (error) {
      console.error('GitHub OIDC verification failed:', error);
      return new NextResponse('Unauthorized - Invalid or expired token', { status: 401 });
    }
  }

  // For all other routes, require authentication
  const session = await auth();
  if (!session.userId) {
    // Redirect to sign-in if not authenticated
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('redirect_url', request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

// Only run middleware on relevant routes
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
