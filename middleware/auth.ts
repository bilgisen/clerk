import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth/better-auth';
import { cookies } from 'next/headers';
import type { AuthContextUnion, SessionAuthContext } from '@/types/auth.types';

// Re-export types from auth.types.ts for backward compatibility
export type { AuthContextUnion, SessionAuthContext } from '@/types/auth.types';

type UnauthorizedContext = {
  type: 'unauthorized';
};

declare module 'next/server' {
  interface NextRequest {
    authContext: AuthContextUnion;
  }
}

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
  return async function (request: NextRequest, context: { params: TParams }) {
    try {
      // Create a new request with cookies for auth
      const authRequest = new Request(request.url, {
        headers: {
          cookie: request.headers.get('cookie') || '',
        },
      });
      
      // Get the session using the auth handler
      const response = await auth.handler(authRequest);
      const session = await response.json();
      
      if (!session?.user) {
        return createErrorResponse(401, 'UNAUTHORIZED', 'You must be signed in');
      }

      // Attach auth context to request
      request.authContext = {
        type: 'session',
        user: {
          id: session.user.id,
          email: session.user.email,
          firstName: session.user.firstName || undefined,
          lastName: session.user.lastName || undefined,
          imageUrl: session.user.imageUrl || undefined,
          emailVerified: session.user.emailVerified,
          role: (session.user as any).role || 'MEMBER',
          permissions: (session.user as any).permissions || ['read:books']
        },
        sessionId: session.session?.id || 'unknown',
        createdAt: new Date().toISOString()
      };

      return handler(request, { params: context.params, authContext: request.authContext });
    } catch (error) {
      console.error('Auth middleware error:', error);
      return createErrorResponse(500, 'INTERNAL_ERROR', 'Authentication failed');
    }
  };
}

// Optional Auth Middleware
export function withOptionalAuth<TParams = Record<string, string>>(
  handler: HandlerWithAuth<TParams>
) {
  return async function (request: NextRequest, context: { params: TParams }) {
    try {
      // Create a new request with cookies for auth
      const authRequest = new Request(request.url, {
        headers: {
          cookie: request.headers.get('cookie') || '',
        },
      });
      
      // Get the session using the auth handler
      const response = await auth.handler(authRequest);
      const session = await response.json();
      
      if (session?.user) {
        request.authContext = {
          type: 'session',
          user: {
            id: session.user.id,
            email: session.user.email,
            firstName: session.user.firstName || undefined,
            lastName: session.user.lastName || undefined,
            imageUrl: session.user.imageUrl || undefined,
            emailVerified: session.user.emailVerified,
            role: (session.user as any).role || 'MEMBER',
            permissions: (session.user as any).permissions || ['read:books']
          },
          sessionId: session.session?.id || 'unknown',
          createdAt: new Date().toISOString()
        };
      } else {
        request.authContext = { type: 'unauthorized' };
      }

      return handler(request, { params: context.params, authContext: request.authContext });
    } catch (error) {
      console.error('Optional auth middleware error:', error);
      // For optional auth, we still proceed but with unauthorized context
      request.authContext = { type: 'unauthorized' };
      return handler(request, { params: context.params, authContext: request.authContext });
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
