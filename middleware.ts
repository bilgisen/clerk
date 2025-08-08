import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from 'next/server';
import { verifyToken } from './lib/auth';

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

// These routes are protected and require authentication
const protectedRoutes = [
  '^/dashboard(?:/.*)?$',
  '^/api/books(?:/.*)?$'
];

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;
  const method = req.method;
  const url = req.nextUrl.toString();

  console.log(`[Middleware] ${req.method} ${req.nextUrl.pathname}`, {
    url: req.url,
    referer: req.headers.get('referer')
  });
  
  // Allow public routes
  if (isPublicRoute(req)) {
    console.log(`[Middleware] Allowing public route: ${req.nextUrl.pathname}`);
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

  // Handle protected API routes with JWT first
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
      // Verify the JWT token
      const decoded = await verifyToken(token, { operation: 'middleware-auth' });
      
      if (!decoded) {
        throw new Error('Failed to verify token');
      }

      console.log(`[Middleware] Token verified for user: ${decoded.userId}`);

      // Clone the request headers and add user ID
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set('x-user-id', decoded.userId);
      requestHeaders.set('x-auth-method', 'jwt');

      // Add any metadata from the token to headers
      if (decoded.metadata) {
        requestHeaders.set('x-auth-metadata', JSON.stringify(decoded.metadata));
      }

      const response = NextResponse.next({
        request: { headers: requestHeaders },
      });

      // Add debug headers to the response
      response.headers.set('x-auth-method', 'jwt');
      response.headers.set('x-auth-user-id', decoded.userId);

      return response;
    } catch (error) {
      console.error('[Middleware] JWT verification failed, falling back to Clerk session', error);
      
      // Fall back to Clerk session if JWT verification fails
      try {
        const session = await auth();
        
        if (!session?.userId) {
          console.error('[Middleware] No active session found');
          return new NextResponse(JSON.stringify({
            error: 'Unauthorized - No valid authentication provided',
            status: 401,
            path: pathname
          }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        console.log(`[Middleware] Clerk session verified for user: ${session.userId}`);

        const requestHeaders = new Headers(req.headers);
        requestHeaders.set('x-user-id', session.userId);
        requestHeaders.set('x-auth-method', 'session');

        const response = NextResponse.next({
          request: { headers: requestHeaders },
        });

        response.headers.set('x-auth-method', 'session');
        response.headers.set('x-auth-user-id', session.userId);

        return response;
      } catch (sessionError) {
        console.error('[Middleware] Error verifying Clerk session:', sessionError);
        return new NextResponse(JSON.stringify({
          error: 'Authentication failed',
          status: 401,
          path: pathname
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  }

  // Handle other protected routes (non-API)
  const isProtected = protectedRoutes.some(route => new RegExp(route).test(pathname));
  if (isProtected) {
    try {
      const session = await auth();
      
      console.log('[Middleware] Auth result:', {
        userId: session.userId,
        sessionId: session.sessionId,
        sessionClaims: session.sessionClaims
      });

      if (!session?.userId) {
        console.log('[Middleware] No user session found, redirecting to sign-in');
        const signInUrl = new URL('/sign-in', req.nextUrl.origin);
        signInUrl.searchParams.set('redirect_url', pathname);
        return NextResponse.redirect(signInUrl);
      }
      
      console.log(`[Middleware] User ${session.userId} authenticated, allowing access to ${req.nextUrl.pathname}`);
      
      // Add user ID to headers for API routes
      if (req.nextUrl.pathname.startsWith('/api/')) {
        const requestHeaders = new Headers(req.headers);
        requestHeaders.set('x-user-id', session.userId);
        requestHeaders.set('x-auth-method', 'session');
        return NextResponse.next({ request: { headers: requestHeaders } });
      }
      
      return NextResponse.next();
    } catch (error) {
      console.error('[Middleware] Error in protected route handler:', error);
      const signInUrl = new URL('/sign-in', req.nextUrl.origin);
      signInUrl.searchParams.set('redirect_url', pathname);
      return NextResponse.redirect(signInUrl);
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