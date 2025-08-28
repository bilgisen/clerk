import { NextResponse, type NextRequest } from 'next/server';
import { withGithubOidcAuth, type HandlerWithAuth } from '@/middleware/auth';
import { updateSession, PublishSession } from '@/lib/store/redis';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type FinalizeRequest = {
  success: boolean;
  message?: string;
  result?: {
    artifactUrl?: string;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
  };
  error?: {
    message: string;
    code?: string;
    [key: string]: unknown;
  };
};

const handler: HandlerWithAuth = async (request: NextRequest, context) => {
  try {
    const { authContext } = context || {};
    
    // Log the authentication context for debugging
    logger.info('Finalize request received', { 
      authType: authContext?.type,
      userId: authContext?.type === 'github-oidc' ? authContext.userId : 'unknown'
    });
    
    // Ensure this is an OIDC-authenticated request
    if (authContext?.type !== 'github-oidc') {
      logger.warn('Invalid authentication type', { authType: authContext?.type });
      return NextResponse.json(
        { error: 'invalid_auth', message: 'This endpoint requires GitHub OIDC authentication' },
        { status: 401 }
      );
    }

    const { success, result, error } = (await request.json()) as FinalizeRequest;
    
    // Update the session in Redis as completed
    const sessionId = authContext.claims?.sid;
    if (!sessionId) {
      logger.error('Missing session ID in auth context');
      return NextResponse.json(
        { error: 'Missing session ID in authentication context' },
        { status: 400 }
      );
    }
    
    const updateData: Partial<PublishSession> = {
      status: success ? 'completed' : 'failed',
      updatedAt: Date.now(),
      ...(success && result ? { downloadUrl: result.artifactUrl } : {}),
      ...(error ? { 
        error: {
          message: error.message || 'Unknown error',
          ...(error.code && { code: error.code })
        } 
      } : {})
    };
    
    const updated = await updateSession(sessionId, updateData);

    if (!updated) {
      return NextResponse.json(
        { error: 'Session not found or update failed' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error finalizing publish', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined 
    });
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
        success: false
      },
      { status: 500 }
    );
  }
};

export const POST = withGithubOidcAuth(handler);
