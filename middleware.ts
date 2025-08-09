import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from 'next/server';
import { verifyToken } from './lib/auth';
import { verifyGithubOidc } from './lib/auth/verifyGithubOidc';

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/api/auth/token',
  '/api/webhooks(.*)',
]);

// Define API routes that require authentication (either JWT or Clerk session)
const isApiRoute = (pathname: string) => {
  return (
    pathname.startsWith('/api/books/by-id/') ||
    pathname.startsWith('/api/books/by-slug/')
  );
};

// These routes are protected and require authentication
const protectedRoutes = [
  '^/dashboard(?:/.*)?$',
  '^/api/books/(?!by-id/.*/(payload|chapters|html|by-slug/.*/chapters/.*/html)).*$'
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

  // Handle API routes that can use either JWT, GitHub OIDC, or Clerk session
  if (isApiRoute(pathname)) {
    console.log(`[Middleware] Processing API route: ${pathname}`);
    
    const authHeader = req.headers.get('authorization');
    
    // If Authorization header is provided, try GitHub OIDC first, then fallback JWT
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const claims = await verifyGithubOidc(token);
        // OIDC verified
        const requestHeaders = new Headers(req.headers);
        requestHeaders.set('x-auth-method', 'oidc');
        requestHeaders.set('x-auth-user-id', claims.sub || 'ci');
        requestHeaders.set('x-oidc-repo', claims.repository || '');
        requestHeaders.set('x-oidc-ref', claims.ref || '');
        requestHeaders.set('x-oidc-workflow', claims.workflow || '');
        const response = NextResponse.next({ request: { headers: requestHeaders } });
        response.headers.set('x-auth-method', 'oidc');
        return response;
      } catch (_oidcErr) {
        // Not a valid OIDC token; try app JWT next
        try {
          const decoded = await verifyToken(token, { operation: 'middleware-auth' });
          if (!decoded) throw new Error('Failed to verify token');
          const requestHeaders = new Headers(req.headers);
          requestHeaders.set('x-user-id', decoded.userId);
          requestHeaders.set('x-auth-method', 'jwt');
          if (decoded.metadata) requestHeaders.set('x-auth-metadata', JSON.stringify(decoded.metadata));
          const response = NextResponse.next({ request: { headers: requestHeaders } });
          response.headers.set('x-auth-method', 'jwt');
          response.headers.set('x-auth-user-id', decoded.userId);
          return response;
        } catch (_jwtErr) {
          // Continue to Clerk session authentication
        }
      }
    }

    // If we get here, either no auth header was provided or JWT verification failed
    // Try to authenticate with Clerk session
    console.log('[Middleware] No valid JWT token, trying Clerk session authentication');
    
    try {
      const session = await auth();
      
      if (!session?.userId) {
        console.error('[Middleware] No active session found');
        return new NextResponse(JSON.stringify({
          error: 'Unauthorized - No valid authentication provided',
          status: 401,
          path: pathname,
          authMethod: 'none'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // If we get here, Clerk session is valid
      console.log(`[Middleware] Clerk session verified for user: ${session.userId}`);
      
      // Set up response with user info
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set('x-user-id', session.userId);
      requestHeaders.set('x-auth-method', 'session');
      
      const response = NextResponse.next({
        request: { headers: requestHeaders },
      });
      
      response.headers.set('x-auth-method', 'session');
      response.headers.set('x-auth-user-id', session.userId);
      
      return response;
    } catch (error) {
      console.error('[Middleware] Error verifying Clerk session:', error);
      return new NextResponse(JSON.stringify({
        error: 'Authentication failed',
        status: 401,
        path: pathname,
        authMethod: 'error'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
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