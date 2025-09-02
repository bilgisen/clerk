import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/better-auth';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = cookies();
    
    // Call the auth signout endpoint
    await auth.api.signOut({
      headers: {
        cookie: cookieStore.toString()
      }
    });

    // Create response with cleared cookies
    const response = NextResponse.json(
      { success: true },
      { status: 200 }
    );

    // Clear the session cookies
    response.cookies.set({
      name: 'auth-token',
      value: '',
      expires: new Date(0),
      path: '/',
    });
    
    response.cookies.set({
      name: '__Secure-auth.session-token',
      value: '',
      expires: new Date(0),
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'lax' as const,
    });

    return response;
  } catch (error) {
    console.error('Sign out error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to sign out' },
      { status: 500 }
    );
  }
}

// Prevent caching of this route
export const dynamic = 'force-dynamic';
