// middleware.ts - ALTERNATİF VERSİYON
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/api/books/(?!by-id/.*/payload)(.*)', // payload hariç tüm books API
  '/api/(?!ci/)(.*)', // ci hariç tüm API
]);

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) {
    auth.protect(); // direkt protect() çağrısı
  }
  
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Clerk uygulanacak route'lar
    '/((?!_next|api/ci|api/books/.*/payload|static|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|eot|json|xml|txt|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/trpc/:path*',
  ],
};