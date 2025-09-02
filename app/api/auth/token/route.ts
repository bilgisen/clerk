import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/better-auth';
import type { NextRequest } from 'next/server';

// Match better-auth's session user type
type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  emailVerified?: Date | null;
  role?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  image?: string | null;
  permissions?: string[];
};

/**
 * Generate an authentication token for the current user
 * This token can be used for API authentication
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Not authenticated' }, 
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, max-age=0'
          } 
        }
      );
    }

    const user = session.user;
    
    // Transform to the shape we want in our token
    const userData = {
      id: user.id,
      email: user.email,
      name: user.name ?? '',
      emailVerified: user.hasOwnProperty("emailVerified") 
        ? !!(user as any).emailVerified 
        : false,
      role: user.role ?? 'user',
      ...(user.permissions && { permissions: user.permissions })
    };

    const token = Buffer.from(
      JSON.stringify({
        ...userData,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
      })
    ).toString('base64');

    return NextResponse.json({ 
      success: true,
      token,
      user: userData,
      expiresIn: '7d',
      message: 'Token generated successfully'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (error) {
    console.error('Error generating auth token:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        message: 'Failed to generate authentication token'
      },
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

// Ensure this route is not cached
export const dynamic = 'force-dynamic';
