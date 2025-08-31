import { auth } from '@/lib/auth/better-auth';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const sessionCookie = cookies().get('auth-session')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get the session from the request
    const headers = new Headers();
    headers.append('cookie', `auth-session=${sessionCookie}`);
    
    const session = await auth.api.getSession({ headers });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Return the user data
    return NextResponse.json({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: (session.user as any).role || 'user',
      image: session.user.image,
    });
  } catch (error) {
    console.error('Error fetching user data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;
