import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSession } from '../redis/session';
import { logger } from '../logger';

// Types for the handler function
type Handler<T = any> = (
  req: NextRequest,
  params: T,
  session: { sessionId: string; userId: string }
) => Promise<NextResponse> | NextResponse | Promise<Response> | Response;

// Middleware options
interface MiddlewareOptions {
  requireSession?: boolean;
  requireUser?: boolean;
  requireBookAccess?: boolean;
}

/**
 * Middleware that verifies the combined token and adds session/user info to the request
 */
export function withCombinedToken<T = any>(
  handler: Handler<T>,
  options: MiddlewareOptions = {}
) {
  const {
    requireSession = true,
    requireUser = true,
    requireBookAccess = false,
  } = options;

  return async (req: NextRequest, params: T): Promise<Response> => {
    try {
      // Get the authorization header
      const authHeader = req.headers.get('authorization');
      
      if (!authHeader) {
        logger.warn('Missing authorization header');
        return NextResponse.json(
          { error: 'Unauthorized', code: 'MISSING_AUTH_HEADER' },
          { status: 401 }
        );
      }

      // Extract the token
      const token = authHeader.replace(/^Bearer\s+/i, '');
      
      if (!token) {
        logger.warn('Missing bearer token');
        return NextResponse.json(
          { error: 'Unauthorized', code: 'MISSING_BEARER_TOKEN' },
          { status: 401 }
        );
      }

      // For development, you might want to skip verification in certain cases
      if (process.env.NODE_ENV === 'development' && token === 'dev-skip-auth') {
        return handler(req, params, {
          sessionId: 'dev-session-id',
          userId: 'dev-user-id',
        });
      }

      // Verify the token with Clerk
      const { userId } = auth();
      if (!userId) {
        logger.warn('No user ID found in session');
        return NextResponse.json(
          { error: 'Unauthorized', code: 'INVALID_CLERK_SESSION' },
          { status: 401 }
        );
      }
      
      // Get the session from Redis using the token
      const session = await getSession(token);
      
      if (!session && requireSession) {
        logger.warn('Session not found or expired', { token });
        return NextResponse.json(
          { error: 'Session expired', code: 'SESSION_EXPIRED' },
          { status: 401 }
        );
      }
      
      // Verify the session belongs to the authenticated user
      if (session?.userId !== userId) {
        logger.warn('Session user ID does not match authenticated user', { 
          sessionUserId: session?.userId, 
          authUserId: userId 
        });
        return NextResponse.json(
          { error: 'Unauthorized', code: 'USER_MISMATCH' },
          { status: 403 }
        );
      }


      // Verify user access if required
      if (requireUser && !session?.userId) {
        logger.warn('User ID not found in session', { sessionId: session?.id });
        return NextResponse.json(
          { error: 'Unauthorized', code: 'USER_REQUIRED' },
          { status: 403 }
        );
      }

      // Verify book access if required (implementation depends on your requirements)
      if (requireBookAccess && session) {
        // Add your book access verification logic here
        // For example, check if the user has access to the requested book
        // This is a placeholder - implement according to your requirements
        const hasAccess = true; // Replace with actual access check
        
        if (!hasAccess) {
          logger.warn('Book access denied', { 
            userId: session.userId, 
            sessionId: session.id 
          });
          
          return NextResponse.json(
            { error: 'Forbidden', code: 'ACCESS_DENIED' },
            { status: 403 }
          );
        }
      }

      // Call the handler with the session info
      return handler(
        req,
        params,
        {
          sessionId: session?.id || '',
          userId: session?.userId || '',
        }
      );
    } catch (error) {
      logger.error('Error in withCombinedToken middleware', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        url: req.url,
        method: req.method,
      });

      return NextResponse.json(
        { 
          error: 'Internal Server Error', 
          code: 'MIDDLEWARE_ERROR' 
        },
        { status: 500 }
      );
    }
  };
}
