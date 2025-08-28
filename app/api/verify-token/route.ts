import { NextResponse } from 'next/server';
import { verifyCombinedToken } from '@/lib/auth/combined-token';

const AUDIENCE = process.env.COMBINED_JWT_AUD || 'clerk-actions';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.split(' ')[1] || '';
  
  if (!token) {
    return NextResponse.json(
      { valid: false, error: 'No token provided' },
      { status: 401 }
    );
  }

  try {
    const payload = await verifyCombinedToken(token, AUDIENCE);
    
    return NextResponse.json({
      valid: true,
      payload: {
        sessionId: payload.session_id,
        userId: payload.user_id,
        contentId: payload.content_id,
        tokenType: payload.token_type,
        permissions: payload.permissions,
        expiresAt: new Date(payload.exp * 1000).toISOString(),
      }
    });
  } catch (error) {
    console.error('Token verification failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Invalid token';
    
    return NextResponse.json(
      { 
        valid: false, 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 401 }
    );
  }
}
