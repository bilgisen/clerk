import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createToken, verifyToken } from '@/lib/auth';

export async function GET() {
  try {
    const token = await createToken();
    return NextResponse.json({ token });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 401 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    
    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }
    
    const payload = await verifyToken(token);
    
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }
    
    return NextResponse.json({ 
      valid: true, 
      payload: {
        userId: payload.userId,
        iat: payload.iat,
        exp: payload.exp
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.json(
      { error: 'Token verification failed' },
      { status: 400 }
    );
  }
}

// Set the runtime to 'edge' for better performance
export const runtime = 'edge';
