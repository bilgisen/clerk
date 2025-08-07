import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from 'next/server';

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/api/auth/token',
  '/api/webhooks(.*)',
]);

// Define protected API routes that require JWT authentication
const isProtectedApiRoute = (pathname: string) => {
  return (
    pathname.startsWith('/api/books/by-id/') ||
    pathname.startsWith('/api/books/by-slug/') ||
    pathname.startsWith('/api/protected')
  );
};

// Explicitly define routes that should be handled by Clerk's auth
const clerkAuthRoutes = [
  '/dashboard(.*)',
  '/api/books(.*)'
];

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

  // Skip auth in development if DISABLE_AUTH is set
  if (process.env.NODE_ENV === 'development' && process.env.DISABLE_AUTH === 'true') {
    console.warn('[Middleware] ⚠️ Auth is disabled in development mode');
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-user-id', 'dev-user-id');
    requestHeaders.set('x-auth-method', 'development');
    return NextResponse.next({ request: { headers: requestHeaders } });
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
      // Get the session from Clerk
      const session = await auth();
      
      if (!session?.userId) {
        console.error('[Middleware] No active session found');
        return new NextResponse(JSON.stringify({
          error: 'Unauthorized',
          status: 401,
          path: pathname
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      console.log(`[Middleware] Session verified for user: ${session.userId}`);

      // Clone the request headers and add user ID
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set('x-user-id', session.userId);
      requestHeaders.set('x-auth-method', 'session');

      const response = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });

      // Add debug headers to the response
      response.headers.set('x-auth-method', 'session');
      response.headers.set('x-auth-user-id', session.userId);

      return response;
    } catch (error) {
      console.error('[Middleware] Error verifying session:', error);
      return new NextResponse(JSON.stringify({
        error: 'Internal server error during authentication',
        status: 500,
        path: pathname
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // For other protected routes, use Clerk's default auth
  const isProtectedRoute = clerkAuthRoutes.some(route => 
    new RegExp(`^${route.replace(/\*/g, '.*')}$`).test(pathname)
  );

  if (isProtectedRoute) {
    try {
      const session = await auth();
      
      if (!session?.userId) {
        console.log('[Middleware] No session found, redirecting to sign-in');
        const signInUrl = new URL('/sign-in', req.url);
        signInUrl.searchParams.set('redirect_url', req.url);
        return NextResponse.redirect(signInUrl);
      }
      
      // Add user ID to request headers for API routes
      if (pathname.startsWith('/api/')) {
        const requestHeaders = new Headers(req.headers);
        requestHeaders.set('x-user-id', session.userId);
        return NextResponse.next({ request: { headers: requestHeaders } });
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
  }

  return NextResponse.next();
});

// Configure which routes should be processed by the middleware
export const config = {
  matcher: [
    // Match all request paths except:
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    // - public folder
    // - public files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    // Always run for API routes
    "/api/:path*",
    // Protect dashboard routes
    "/dashboard/:path*"
  ],
};
