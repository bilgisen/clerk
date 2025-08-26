// middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/api/:path*", // tüm API'leri kapsa
]);

export default clerkMiddleware((auth, req) => {
  const { pathname } = req.nextUrl;

  // İstisnalar → auth devre dışı
  if (pathname.startsWith("/api/ci")) {
    return NextResponse.next();
  }
  if (/^\/api\/books\/[^/]+\/payload$/.test(pathname)) {
    return NextResponse.next();
  }

  // Korumalı route
  if (isProtectedRoute(req)) {
    auth.protect();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // tüm route’lar (next/image, static ve favicon hariç)
    "/((?!_next/static|_next/image|favicon.ico).*)",
    "/trpc/(.*)",
  ],
};
