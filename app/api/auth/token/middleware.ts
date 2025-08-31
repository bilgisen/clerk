import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/better-auth';

// This function can be marked `async` if using `await` inside
export async function middleware(request: NextRequest) {
  // Call the auth middleware
  const response = await auth.handler(request);
  
  // If the response is not ok, return it (unauthorized)
  if (!response.ok) {
    return new NextResponse(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Continue with the request
  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: '/api/auth/token',
};
