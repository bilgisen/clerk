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
  return (
    pathname.startsWith('/api/protected') ||
    pathname.startsWith('/api/books/by-id/') ||
    pathname.startsWith('/api/books/by-slug/')
  );
};

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;
  const method = req.method;
  const url = req.nextUrl.toString();

  console.log(`[Middleware] ${method} ${pathname}`);

  // Allow public routes
  if (isPublicRoute(req)) {
    console.log(`[Middleware] Allowing public route: ${pathname}`);
    return NextResponse.next();
  }

  // Handle protected API routes with JWT
  if (isProtectedApiRoute(pathname)) {
    console.log(`[Middleware] Processing protected API route: ${pathname}`);
    
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[Middleware] No or invalid Authorization header');
      return new NextResponse(JSON.stringify({ 
        error: 'No token provided',
        status: 401,
        path: pathname
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.split(' ')[1];
    console.log(`[Middleware] JWT token received (first 10 chars): ${token.substring(0, 10)}...`);

    try {
      const { verifyToken } = await import('@/lib/auth');
      const payload = await verifyToken(token);

      if (!payload) {
        console.error('[Middleware] Token verification failed: Invalid or expired token');
        return new NextResponse(JSON.stringify({
          error: 'Invalid or expired token',
          status: 401,
          path: pathname
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      console.log(`[Middleware] Token verified for user: ${payload.userId}`);

      // Clone the request headers and add user ID
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set('x-user-id', payload.userId as string);
      requestHeaders.set('x-auth-method', 'jwt');

      const response = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });

      // Add debug headers to the response
      response.headers.set('x-auth-method', 'jwt');
      response.headers.set('x-auth-user-id', payload.userId as string);

      return response;
    } catch (error) {
      console.error('[Middleware] Error verifying token:', error);
      return new NextResponse(JSON.stringify({
        error: 'Internal server error during token verification',
        status: 500,
        path: pathname
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // For other routes, use Clerk's default auth
  try {
    const session = await auth();
    if (!session?.userId) {
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', req.url);
      return NextResponse.redirect(signInUrl);
    }
  } catch (error) {
    console.error('[Middleware] Error in Clerk auth:', error);
    return new NextResponse(JSON.stringify({
      error: 'Authentication error',
      status: 500
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
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
