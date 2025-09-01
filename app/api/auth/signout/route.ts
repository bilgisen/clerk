import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth/better-auth';

export async function POST() {
  try {
    // Clear the session cookie
    const response = NextResponse.json(
      { message: 'Signed out successfully' },
      { 
        status: 200,
        headers: {
          'Set-Cookie': `auth-session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; ${process.env.NODE_ENV === 'production' ? 'Secure; SameSite=Lax' : 'SameSite=Lax'}`
        }
      }
    );

    // If you need to invalidate the session on the server side as well
    try {
      await auth.api.signOut();
    } catch (error) {
      console.error('Error invalidating session on server:', error);
      // Continue even if server-side invalidation fails
    }

    return response;
  } catch (error) {
    console.error('Error signing out:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Disable caching for this route
export const dynamic = 'force-dynamic';
