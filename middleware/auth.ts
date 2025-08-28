import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { verifyGitHubOidcToken } from './github-oidc';

export type AuthType = 'clerk' | 'github-oidc' | 'unauthorized';

interface ClerkSession {
  userId: string;
  sessionId: string;
  getToken: () => Promise<string | null>;
}

export interface ClerkAuthContext {
  type: 'clerk';
  userId: string;
  sessionId: string;
  claims?: Record<string, unknown>;
}

export interface GitHubOidcAuthContext {
  type: 'github-oidc';
  userId: string;
  claims: Record<string, unknown>;
  repository: string;
  repositoryOwner: string;
  actor: string;
  ref: string;
  sha: string;
  workflow: string;
  runId: string;
}

export type AuthContextUnion = ClerkAuthContext | GitHubOidcAuthContext | { type: 'unauthorized' };

export interface HandlerWithAuth {
  (req: NextRequest, context: { 
    params?: Record<string, string>; 
    authContext: AuthContextUnion;
  }): Promise<NextResponse>;
}

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
        ...(details && { details }),
      },
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

// GitHub OIDC Auth Middleware
export function withGithubOidcAuth(handler: HandlerWithAuth) {
  return async function (req: NextRequest, context: { params?: Record<string, string> } = {}) {
    const { params } = context;
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return createErrorResponse(401, 'missing_token', 'Missing or invalid authorization header');
    }

    try {
      const token = authHeader.split(' ')[1];
      const claims = await verifyGitHubOidcToken(token);
      
      // Create auth context with proper type assertions
      const authContext: GitHubOidcAuthContext = {
        type: 'github-oidc',
        userId: typeof claims.sub === 'string' ? claims.sub : 'unknown',
        claims,
        repository: typeof claims.repository === 'string' ? claims.repository : 'unknown/repo',
        repositoryOwner: typeof claims.repository_owner === 'string' ? claims.repository_owner : 'unknown',
        actor: typeof claims.actor === 'string' ? claims.actor : 'unknown',
        ref: typeof claims.ref === 'string' ? claims.ref : 'unknown',
        sha: typeof claims.sha === 'string' ? claims.sha : 'unknown',
        workflow: typeof claims.workflow === 'string' ? claims.workflow : 'unknown',
        runId: typeof claims.run_id === 'string' ? claims.run_id : 'unknown',
      };

      return handler(req, { params, authContext });
    } catch (error) {
      console.error('GitHub OIDC verification failed:', error);
      return createErrorResponse(401, 'invalid_token', 'Invalid or expired token');
    }
  };
}

// Clerk Auth Middleware
export function withClerkAuth(handler: HandlerWithAuth) {
  return async function (req: NextRequest, context: { params?: Record<string, string> } = {}) {
    try {
      const session = auth();
      const user = await currentUser();
      
      if (!session || !user) {
        return createErrorResponse(401, 'unauthorized', 'Authentication required');
      }

      const authContext: ClerkAuthContext = {
        type: 'clerk',
        userId: user.id,
        sessionId: session.sessionId || 'unknown',
        claims: user,
      };

      return handler(req, { ...context, authContext });
    } catch (error) {
      console.error('Clerk auth failed:', error);
      return createErrorResponse(401, 'authentication_failed', 'Authentication failed');
    }
  };
}

// Optional Auth Middleware
export function withOptionalAuth(handler: HandlerWithAuth) {
  return async function (req: NextRequest, context: { params?: Record<string, string> } = {}) {
    try {
      const session = auth();
      const user = await currentUser();
      
      const authContext: AuthContextUnion = (session && user)
        ? { 
            type: 'clerk', 
            userId: user.id, 
            sessionId: session.sessionId || 'unknown',
            claims: user
          }
        : { type: 'unauthorized' };

      return handler(req, { ...context, authContext });
    } catch (error) {
      // If auth fails, continue as unauthorized
      return handler(req, { ...context, authContext: { type: 'unauthorized' } });
    }
  };
}
