import { auth } from '@/lib/auth/better-auth';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const sessionCookie = cookies().get('auth-session')?.value;
    
    if (sessionCookie) {
      // Invalidate the session
      const headers = new Headers();
      headers.append('cookie', `auth-session=${sessionCookie}`);
      
      await auth.api.signOut({ headers });
    }

    // Create response with success message
    const response = NextResponse.json(
      { message: 'Signed out successfully' },
      { status: 200 }
    );

    // Clear the auth cookie
    response.cookies.set({
      name: 'auth-session',
      value: '',
      path: '/',
      expires: new Date(0),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    console.error('Error signing out:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;
