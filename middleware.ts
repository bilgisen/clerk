// middleware.ts - DAHA BASİT YÖNTEM
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/api/(.*)',
]);

export default clerkMiddleware((auth, req) => {
  // Doğrudan protect() çağrısı - Clerk bunu doğru şekilde işler
  if (isProtectedRoute(req)) {
    auth.protect();
  }
  
  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/ci|api/books/.*/payload).*)',
    '/trpc/(.*)',
  ],
};