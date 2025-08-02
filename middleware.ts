import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from 'next/server';

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/api/auth/token',
]);

// Define protected API routes that require JWT authentication
const isProtectedApiRoute = (pathname: string) => {
  return pathname.startsWith('/api/protected');
};

export default clerkMiddleware(async (auth, req) => {
  const session = await auth();
  const userId = session?.userId;
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Handle protected API routes with JWT
  if (isProtectedApiRoute(pathname)) {
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new NextResponse('No token provided', { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { verifyToken } = await import('@/lib/auth');
    const payload = await verifyToken(token);

    if (!payload) {
      return new NextResponse('Invalid or expired token', { status: 401 });
    }

    // Clone the request headers and add user ID
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-user-id', payload.userId as string);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // For other routes, use Clerk's default auth
  if (!userId) {
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('redirect_url', req.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
