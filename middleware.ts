// middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Public routes (no auth needed)
const isPublicRoute = createRouteMatcher([
  "/",
  "/pricing",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sso-callback(.*)",
  "/api/auth/token",
  "/api/webhooks(.*)",
  "/api/upload",
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

function applyCsp() {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'strict-dynamic' 'nonce-${nonce}' 'unsafe-inline' https: http: ${
      process.env.NODE_ENV === "production" ? "" : `'unsafe-eval'`
    };
    script-src-elem 'self' 'unsafe-inline' https: http:;
    connect-src 'self'
      https://clerk.editor.bookshall.com
      https://*.clerk.accounts.dev
      https://storage.bookshall.com
      https://challenges.cloudflare.com;
    img-src 'self' https: http: data: blob: https://challenges.cloudflare.com;
    media-src 'self' https: http: data: blob:;
    worker-src 'self' blob:;
    style-src 'self' 'unsafe-inline' https: http:;
    style-src-elem 'self' 'unsafe-inline' https: http:;
    font-src 'self' https: http: data:;
    frame-src 'self' https://clerk.editor.bookshall.com https://*.clerk.accounts.dev https://challenges.cloudflare.com;
    form-action 'self' https://clerk.editor.bookshall.com;
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  return { cspHeader, nonce };
}

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;
  const method = req.method;
  const { cspHeader, nonce } = applyCsp();

  // ✅ 1) BYPASS: GitHub OIDC endpointlerini Clerk’ten tamamen çıkar
  if (pathname.startsWith("/api/ci/") || pathname === "/api/ci") {
    const response = NextResponse.next({
      request: {
        headers: new Headers({
          ...Object.fromEntries(req.headers),
          "x-nonce": nonce,
        }),
      },
    });
    response.headers.set("Content-Security-Policy", cspHeader);
    return response;
  }

  console.log(`[Middleware] ${method} ${pathname}`, {
    url: req.url,
    referer: req.headers.get("referer"),
  });

  // Yeni bir Headers nesnesi oluşturun
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  // ✅ Allow public routes
  if (isPublicRoute(req)) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", cspHeader);
    return response;
  }

  // ✅ Skip auth in dev mode if disabled
  if (
    process.env.NODE_ENV === "development" &&
    process.env.DISABLE_AUTH === "true"
  ) {
    requestHeaders.set("x-user-id", "dev-user-id");
    requestHeaders.set("x-auth-method", "development");
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", cspHeader);
    return response;
  }

  // ✅ API routes with auth
  if (isApiRoute(pathname)) {
    try {
      const session = await auth();
      if (!session?.userId) {
        return new NextResponse(
          JSON.stringify({
            error: "Unauthorized - Please sign in",
            status: 401,
            path: pathname,
            authMethod: "none",
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      requestHeaders.set("x-user-id", session.userId);
      requestHeaders.set("x-auth-method", "session");

      const response = NextResponse.next({ request: { headers: requestHeaders } });
      response.headers.set("x-auth-method", "session");
      response.headers.set("x-auth-user-id", session.userId);
      response.headers.set("Content-Security-Policy", cspHeader);
      return response;
    } catch (error) {
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
    } catch {
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

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", cspHeader);
  return response;
});

/**
 * ✅ 2) MATCHER: /api/ci/** isteklerini tamamen middleware dışına al
 *    Bu sayede Clerk middleware hiç çalışmaz; CI route’un doğrudan handler’a gider.
 */
export const config = {
  matcher: [
    // Tüm app route'ları ama _next, statikler ve **/api/ci/** HARİÇ
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)|api/ci(?:/.*)?).*)",
    // API/TRPC için de **/api/ci/** hariç
    "/(api|trpc)(?!/ci)(.*)",
  ],
};
