import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyCombinedToken } from '@/lib/auth/combined';
import { getSession } from '@/lib/redis/session';

export async function withCombinedToken(
  req: NextRequest,
  handler: (req: NextRequest, claims: any) => Promise<NextResponse>
) {
  try {
    // Get the Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new NextResponse(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Extract the token
    const token = authHeader.split(' ')[1];
    
    try {
      // Verify the token
      const claims = await verifyCombinedToken(token);
      
      // Check if the session exists and is valid
      const session = await getSession(claims.sid);
      if (!session) {
        return new NextResponse(
          JSON.stringify({ error: 'Invalid or expired session' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Check if the token is expired
      if (new Date(session.expiresAt) < new Date()) {
        return new NextResponse(
          JSON.stringify({ error: 'Token has expired' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Add the claims to the request object
      (req as any).auth = claims;
      
      // Call the handler
      return handler(req, claims);
    } catch (error: any) {
      console.error('Token verification failed:', error);
      return new NextResponse(
        JSON.stringify({ 
          error: 'Invalid token',
          details: error.message 
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Authentication failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Helper function to create a middleware handler
export function createAuthMiddleware(handler: (req: NextRequest, claims: any) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    return withCombinedToken(req, handler);
  };
}
