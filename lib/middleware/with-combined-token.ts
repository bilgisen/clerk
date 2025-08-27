import { NextRequest, NextResponse } from 'next/server';
import { verifyCombinedToken } from '@/lib/auth/combined-token';
import { getSession } from '@/lib/store/redis';

export async function withCombinedToken(
  handler: (req: NextRequest, session: any) => Promise<NextResponse>,
  options: {
    requireSession?: boolean;
  } = {}
) {
  return async (req: NextRequest) => {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new NextResponse(
          JSON.stringify({ error: 'Missing or invalid authorization header' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const token = authHeader.split(' ')[1];
      
      // Verify token
      const publicKey = process.env.COMBINED_JWT_PUBLIC_KEY;
      const audience = process.env.COMBINED_JWT_AUDIENCE || 'clerk-actions';
      
      if (!publicKey) {
        console.error('COMBINED_JWT_PUBLIC_KEY is not set');
        return new NextResponse(
          JSON.stringify({ error: 'Server configuration error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const payload = await verifyCombinedToken(token, publicKey, audience);
      
      // Get session
      const session = await getSession(payload.session_id);
      if (!session && options.requireSession !== false) {
        return new NextResponse(
          JSON.stringify({ error: 'Session not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Add session to request
      return handler(req, { ...session, tokenPayload: payload });
      
    } catch (error) {
      console.error('Combined token verification failed:', error);
      
      if (error.message === 'Token has expired') {
        return new NextResponse(
          JSON.stringify({ error: 'Token has expired' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      return new NextResponse(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };
}
