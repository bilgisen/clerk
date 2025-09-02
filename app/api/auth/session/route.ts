import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/better-auth';
import { cookies } from 'next/headers';

interface UserSession {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  emailVerified: boolean;
  role?: string;
  firstName?: string | null;
  lastName?: string | null;
  lastActiveAt?: string | Date | null;
  lastLoginAt?: string | Date | null;
}

/**
 * Get the current user's session
 * This endpoint is used by the client to get the current user's session data
 */
export async function GET() {
  try {
    // Get the session from the request
    const cookieStore = cookies();
    const session = await auth.api.getSession({
      headers: new Headers({
        cookie: cookieStore.toString()
      })
    });
    
    if (!session?.user) {
      return NextResponse.json(
        { user: null },
        { 
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, max-age=0'
          }
        }
      );
    }

    // Map the session user to our UserSession interface
    const user: UserSession = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
      emailVerified: 'emailVerified' in session.user ? session.user.emailVerified as boolean : false,
      role: session.user.role,
      firstName: session.user.firstName,
      lastName: session.user.lastName
    };
    
    // Return only the necessary user data
    return NextResponse.json(
      { 
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          emailVerified: user.emailVerified,
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0'
        }
      }
    );
  } catch (error) {
    console.error('Error getting session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0'
        }
      }
    );
  }
}

// Prevent caching of this route
export const dynamic = 'force-dynamic';