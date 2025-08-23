// middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
// next/headers'ten headers'ı kullanmıyorsanız kaldırabilirsiniz.

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

function applyCsp() { // req parametresi artık gerekli değil
  // Generate a random nonce
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  
  // Define CSP header - GÜNCELLENMİŞ connect-src ve img-src
  // Çok satırlı string'i tek satıra sıkıştırırken dikkatli olun.
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'strict-dynamic' 'nonce-${nonce}' 'unsafe-inline' https: http: ${
      process.env.NODE_ENV === 'production' ? '' : `'unsafe-eval'`
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
  `.replace(/\s{2,}/g, ' ').trim(); // Çoklu boşlukları tek boşlukla değiştir ve kırp

  // CSP başlığını istek başlıklarına koymayın.
  // Bunun yerine, nonce'u bir başlık olarak iletin, böylece sayfa render edilirken kullanılabilir.
  // Veya CSP'yi doğrudan NextResponse başlıklarına ekleyin.

  return { cspHeader, nonce }; // Sadece CSP başlığını ve nonce'u döndür
}

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;
  const method = req.method;
  // applyCsp'den dönen değerlere erişin
  const { cspHeader, nonce } = applyCsp(); 

  console.log(
    `[Middleware] ${method} ${pathname}`,
    { url: req.url, referer: req.headers.get("referer") }
  );

  // Yeni bir Headers nesnesi oluşturun, orijinal req.headers'ı doğrudan değiştirmeyin.
  const requestHeaders = new Headers(req.headers);
  // CSP'yi istek başlıklarına koymak yerine, nonce'u özel bir başlık olarak iletin.
  requestHeaders.set('x-nonce', nonce); 
  // CSP başlığını istek başlıklarına koymayın.

  // ✅ Allow public routes
  if (isPublicRoute(req)) {
    console.log(`[Middleware] Allowing public route: ${pathname}`);
    const response = NextResponse.next({
      request: { headers: requestHeaders }, // CSP yok
    });
    // CSP'yi YANIT başlıklarına ekleyin.
    response.headers.set('Content-Security-Policy', cspHeader);
    return response;
  }

  // ✅ Skip auth in dev mode if disabled
  if (process.env.NODE_ENV === "development" && process.env.DISABLE_AUTH === "true") {
    console.warn("[Middleware] ⚠️ Auth disabled in development mode");
    requestHeaders.set("x-user-id", "dev-user-id");
    requestHeaders.set("x-auth-method", "development");
    const response = NextResponse.next({
      request: { headers: requestHeaders }, // CSP yok
    });
    // CSP'yi YANIT başlıklarına ekleyin.
    response.headers.set('Content-Security-Policy', cspHeader);
    return response;
  }

  // ✅ API routes with auth
  if (isApiRoute(pathname)) {
    console.log(`[Middleware] Processing API route: ${pathname}`);
    try {
      const session = await auth();

      if (!session?.userId) {
        console.error("[Middleware] No active session found");
        // API yanıtlarında genellikle CSP gerekmez, ama isterseniz ekleyebilirsiniz.
        return new NextResponse(
          JSON.stringify({
            error: "Unauthorized - Please sign in",
            status: 401,
            path: pathname,
            authMethod: "none",
          }),
          { 
            status: 401, 
            headers: { 
              "Content-Type": "application/json",
              // CSP'yi buraya eklemeyin, API yanıtı için genellikle gerekli değildir.
              // "Content-Security-Policy": cspHeader // KALDIRILDI
            } 
          }
        );
      }

      console.log(`[Middleware] Clerk session verified for user: ${session.userId}`);
      requestHeaders.set("x-user-id", session.userId);
      requestHeaders.set("x-auth-method", "session");

      const response = NextResponse.next({
        request: { headers: requestHeaders }, // CSP yok
      });
      
      response.headers.set("x-auth-method", "session");
      response.headers.set("x-auth-user-id", session.userId);
      // CSP'yi YANIT başlıklarına ekleyin.
      response.headers.set('Content-Security-Policy', cspHeader);
      
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
        { 
          status: 401, 
          headers: { 
            "Content-Type": "application/json",
            // "Content-Security-Policy": cspHeader // KALDIRILDI
          } 
        }
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
        { 
          status: 401, 
          headers: { 
            "Content-Type": "application/json",
            // "Content-Security-Policy": cspHeader // KALDIRILDI
          } 
        }
      );
    }
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders }, // CSP yok
  });
  
  // CSP'yi YANIT başlıklarına ekleyin.
  response.headers.set('Content-Security-Policy', cspHeader);
  return response;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};