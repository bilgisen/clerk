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
    const url = req.nextUrl.toString();

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
        console.error("[Middleware] Error verifying Clerk session:", error);
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
        const session = await auth();
        console.log("[Middleware] Auth result:", {
          userId: session.userId,
          sessionId: session.sessionId,
          sessionClaims: session.sessionClaims,
        });

        if (!session?.userId) {
          console.log("[Middleware] No user session found, redirecting");
          const signInUrl = new URL("/sign-in", req.nextUrl.origin);
          signInUrl.searchParams.set("redirect_url", pathname);
          return NextResponse.redirect(signInUrl);
        }

        console.log(
          `[Middleware] User ${session.userId} authenticated, allowing access`
        );

        if (pathname.startsWith("/api/")) {
          const requestHeaders = new Headers(req.headers);
          requestHeaders.set("x-user-id", session.userId);
          requestHeaders.set("x-auth-method", "session");
          return NextResponse.next({ request: { headers: requestHeaders } });
        }

        return NextResponse.next();
      } catch (error) {
        console.error("[Middleware] Error in protected route handler:", error);
        const signInUrl = new URL("/sign-in", req.nextUrl.origin);
        signInUrl.searchParams.set("redirect_url", pathname);
        return NextResponse.redirect(signInUrl);
      }
    }

    return NextResponse.next();
  },
  {
    // ✅ Clerk ayarları → authorizedParties eklendi
    authorizedParties: ["https://editor.bookshall.com"],
  }
);

// ✅ Middleware config
export const config = {
  matcher: [
    "/((?!.*\\..*|_next).*)", // Match all routes except static files & _next
    "/",
  ],
};
