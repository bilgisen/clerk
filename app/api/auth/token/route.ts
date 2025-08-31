import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth/better-auth';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get the session from the request
    const response = await getAuth();
    
    if (!response?.user) {
      return new NextResponse(
        JSON.stringify({ error: 'Not authenticated' }), 
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate a token
    const token = Buffer.from(JSON.stringify({
      userId: response.user.id,
      email: response.user.email,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days from now
    })).toString('base64');

    return NextResponse.json({ token });
  } catch (error) {
    console.error('Error generating auth token:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// This ensures that the route is protected and requires authentication
export const dynamic = 'force-dynamic';
