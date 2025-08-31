import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth/better-auth';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const authData = await getAuth();
    
    if (!authData?.user) {
      return new NextResponse(
        JSON.stringify({ error: 'Not authenticated' }), 
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return NextResponse.json({ 
      success: true,
      user: authData.user,
      message: 'You are authenticated!'
    });
  } catch (error) {
    console.error('Authentication test error:', error);
    return new NextResponse(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error' 
      }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Ensure this route is not cached
export const dynamic = 'force-dynamic';
