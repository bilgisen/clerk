import { NextRequest, NextResponse } from 'next/server';
import { verifySecretToken } from './verifySecret';

type AuthResult = 
  | { isAuthenticated: true; userId: string; email?: string }
  | { isAuthenticated: false; response: NextResponse };

/**
 * Authenticate the request using either Clerk or the secret token
 */
export async function authenticateRequest(req: NextRequest): Promise<AuthResult> {
  // First try secret token authentication
  if (verifySecretToken(req)) {
    return {
      isAuthenticated: true,
      userId: 'github-actions',
      email: 'github-actions@github.com'
    };
  }

  // If secret token auth fails, return unauthorized
  return {
    isAuthenticated: false,
    response: new NextResponse(
      JSON.stringify({ 
        error: 'Unauthorized',
        message: 'Invalid or missing authentication token'
      }),
      { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  };
}

/**
 * Middleware to protect routes with secret token authentication
 */
export function withSecretToken(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    const authResult = await authenticateRequest(req);
    if (!authResult.isAuthenticated) {
      return authResult.response;
    }
    return handler(req);
  };
}
