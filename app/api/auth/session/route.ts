import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth/better-auth';

export async function GET() {
  try {
    const response = await getAuth();
    
    if (!response?.user) {
      return new NextResponse(
        JSON.stringify({ user: null }), 
        { 
          status: 200, 
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, max-age=0'
          } 
        }
      );
    }

    return NextResponse.json({ 
      user: {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        image: response.user.image,
        role: response.user.role,
        emailVerified: response.user.emailVerified,
      } 
    });
  } catch (error) {
    console.error('Error getting session:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }), 
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
