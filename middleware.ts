// middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Public routes (no auth needed)
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/auth/token",
  "/api/webhooks(.*)",
]);

// API routes that require authentication
const isApiRoute = (pathname: string) =>
  pathname.startsWith("/api/books/by-id/") ||
  pathname.startsWith("/api/books/by-slug/");

// Regex patterns for protected routes
const protectedRoutes = [
  "^/dashboard(?:/.*)?$",
  "^/api/books/(?!by-id/.*/(payload|chapters|html|by-slug/.*/chapters/.*/html)).*$",
];

export default clerkMiddleware(
  async (auth, req) => {
    const { pathname } = req.nextUrl;
    const method = req.method;

    console.log(
      `[Middleware] ${method} ${pathname}`,
      { url: req.url, referer: req.headers.get("referer") }
    );

    // ✅ Allow public routes
    if (isPublicRoute(req)) {
      console.log(`[Middleware] Allowing public route: ${pathname}`);
      return NextResponse.next();
    }

    // ✅ Skip auth in dev mode if disabled
    if (
      process.env.NODE_ENV === "development" &&
      process.env.DISABLE_AUTH === "true"
    ) {
      console.warn("[Middleware] ⚠️ Auth disabled in development mode");
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set("x-user-id", "dev-user-id");
      requestHeaders.set("x-auth-method", "development");
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    // ✅ API routes with auth
    if (isApiRoute(pathname)) {
      console.log(`[Middleware] Processing API route: ${pathname}`);
      try {
        const session = await auth();

        if (!session?.userId) {
          console.error("[Middleware] No active session found");
          return new NextResponse(
            JSON.stringify({
              error: "Unauthorized - Please sign in",
              status: 401,
              path: pathname,
              authMethod: "none",
            }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }

        console.log(
          `[Middleware] Clerk session verified for user: ${session.userId}`
        );

        const requestHeaders = new Headers(req.headers);
        requestHeaders.set("x-user-id", session.userId);
        requestHeaders.set("x-auth-method", "session");

        const response = NextResponse.next({ request: { headers: requestHeaders } });
        response.headers.set("x-auth-method", "session");
        response.headers.set("x-auth-user-id", session.userId);
        return response;
      } catch (error) {
        console.error("[Middleware] Error verifying session:", error);
        return new NextResponse(
          JSON.stringify({
            error: "Authentication failed",
            status: 401,
            path: pathname,
            authMethod: "error",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // ✅ Protected routes (non-API)
    const isProtected = protectedRoutes.some((route) =>
      new RegExp(route).test(pathname)
    );

    if (isProtected) {
      try {
        await auth.protect();
      } catch (error) {
        console.error("[Middleware] Error protecting route:", error);
        return new NextResponse(
          JSON.stringify({
            error: "Authentication required",
            status: 401,
            path: pathname,
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    return NextResponse.next();
  },
  {
    // Enable automatic CSP configuration for Vercel
    contentSecurityPolicy: {
      strict: true, // Enable strict CSP for better security
    },
  }
);
