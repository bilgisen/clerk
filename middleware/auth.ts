import { NextResponse, type NextRequest } from 'next/server';
import { getServerAuth } from '@/lib/auth/better-auth';

declare module 'next/server' {
  interface NextRequest {
    authContext?: AuthContextUnion;
  }
}

// Auth Context Types
export interface SessionAuthContext {
  type: 'session';
  userId: string;
  sessionId: string;
  email: string;
  role?: string;
  name?: string;
  image?: string | null;
  emailVerified?: boolean;
}

export interface UnauthorizedContext {
  type: 'unauthorized';
}

export type AuthContextUnion = SessionAuthContext | UnauthorizedContext;

// Base type for auth context
export interface BaseAuthContext<TParams = Record<string, string>> {
  params?: TParams;
  authContext: AuthContextUnion;
}

// Handler type that works with any params
export type HandlerWithAuth<TParams = Record<string, string>> = (
  request: NextRequest,
  context: BaseAuthContext<TParams>
) => Promise<NextResponse>;

// Helper to create consistent error responses
function createErrorResponse(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
): NextResponse {
  return new NextResponse(
    JSON.stringify({
      error: {
        code,
        message,
        details,
        timestamp: new Date().toISOString(),
      },
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

// Session-based Auth Middleware
export function withSessionAuth<TParams = Record<string, string>>(
  handler: HandlerWithAuth<TParams>
) {
  return async (request: NextRequest, { params }: { params: TParams }) => {
    try {
      // Get the session from the request
      const auth = await getServerAuth(request);
      
      if (!auth?.user) {
        // Redirect to sign-in page with the current URL as the callback
        const signInUrl = new URL('/sign-in', request.url);
        signInUrl.searchParams.set('callbackUrl', request.url);
        return NextResponse.redirect(signInUrl);
      }

      // Add auth context to the request
      const authContext: SessionAuthContext = {
        type: 'session',
        userId: auth.user.id,
        sessionId: auth.user.id, // Using user ID as session ID for now
        email: auth.user.email,
        role: auth.user.role || 'user',
        name: auth.user.name || auth.user.email?.split('@')[0] || 'User',
      };
      
      // Add auth context to the request
      (request as any).authContext = authContext;

      request.authContext = authContext;

      // Call the handler with the authenticated request
      return handler(request, { params, authContext });
    } catch (error) {
      console.error('Auth middleware error:', error);
      return createErrorResponse(
        500,
        'AUTH_ERROR',
        'Authentication error',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  };
}

// Optional Auth Middleware
export function withOptionalAuth<TParams = Record<string, string>>(
  handler: HandlerWithAuth<TParams>
) {
  return async (request: NextRequest, { params }: { params: TParams }) => {
    try {
      // Try to get the session
      const auth = await getServerAuth(request);
      
      if (!auth?.user) {
        const authContext: UnauthorizedContext = { type: 'unauthorized' };
        request.authContext = authContext;
        return handler(request, { params, authContext });
      }

      // Add auth context to the request
      const authContext: SessionAuthContext = {
        type: 'session',
        userId: auth.user.id,
        sessionId: auth.user.id,
        email: auth.user.email,
        role: auth.user.role || 'user',
        name: auth.user.name || auth.user.email?.split('@')[0] || 'User',
      };
      
      // Add auth context to the request
      (request as any).authContext = authContext;
      return handler(request, { params, authContext });
    } catch (error) {
      console.error('Auth middleware error:', error);
      const authContext: UnauthorizedContext = { type: 'unauthorized' };
      request.authContext = authContext;
      return handler(request, { params, authContext });
    }
  };
}

// Type guard for session auth context
export function isSessionAuthContext(
  context: AuthContextUnion
): context is SessionAuthContext {
  return context.type === 'session';
}

// Type guard for unauthorized context
export function isUnauthorizedContext(
  context: AuthContextUnion
): context is UnauthorizedContext {
  return context.type === 'unauthorized';
}
