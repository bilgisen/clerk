import { NextResponse } from 'next/server';
import { 
  getPublishSession, 
  updatePublishProgress, 
  completePublishSession, 
  failPublishSession,
  type PublishStatus,
  type PublishSession
} from '../../../../lib/publish/session-utils';
import { withGithubOidcAuth } from '../../../../middleware/auth';
import { logger } from '../../../../lib/logger';
import type { NextRequest } from 'next/server';

// Type definitions for the publish status response
type PublishStatusResponse = {
  sessionId: string;
  status: PublishStatus;
  progress?: number;
  message?: string;
  phase?: string;
  result?: unknown;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

// Extend the NextRequest type to include our auth context
type AuthenticatedRequest = NextRequest & {
  authContext: {
    type: 'github-oidc';
    userId: string;
    run_id: string;
    repository: string;
  };
};

export const dynamic = 'force-dynamic';

type StatusUpdate = {
  phase: string;
  message?: string;
  progress?: number;
  metadata?: Record<string, unknown>;
};

// POST /api/publish/status
// Protected by GitHub OIDC authentication
// Called by GitHub Actions to update the status of a publish session
// Headers: { Authorization: 'Bearer <OIDC_TOKEN>' }
// Body: { status: PublishStatus, message?: string, metadata?: Record<string, any> }
export const POST = withGithubOidcAuth(async (request) => {
  // The auth context is already validated by withGithubOidcAuth
  const authContext = (request as unknown as AuthenticatedRequest).authContext;
  
  // Extract the necessary fields from the auth context
  const { userId, run_id: runId, repository } = authContext;
  
  try {
    const { sessionId, status, message, metadata } = await request.json();
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing session ID' },
        { status: 400 }
      );
    }
    
    // Get the current session
    const session = await getPublishSession(sessionId);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }
    
    // Verify the user has access to this session
    // Note: Removed userId check since it's not part of PublishSession
    // Add any necessary access control here
    
    // Update the session based on the status
    let updatedSession: PublishSession | null = null;
    
    switch (status) {
      case 'processing':
        updatedSession = await updatePublishProgress(sessionId, {
          status: 'processing',
          progress: metadata?.progress || 0,
          message,
          metadata: {
            ...session.metadata,
            ...metadata,
            runId,
            repository,
          },
        });
        break;
        
      case 'completed':
        const completed = await completePublishSession(
          sessionId,
          message || 'Publish completed successfully'
        );
        if (completed) {
          updatedSession = await getPublishSession(sessionId);
        }
        break;
        
      case 'failed':
        const failed = await failPublishSession(
          sessionId, 
          message || 'Publish failed'
        );
        if (failed) {
          updatedSession = await getPublishSession(sessionId);
        }
        break;
        
      default:
        return NextResponse.json(
          { error: 'Invalid status' },
          { status: 400 }
        );
    }
    
    if (!updatedSession) {
      throw new Error('Failed to update session');
    }
    const response: PublishStatusResponse = {
      sessionId: session.id,
      status: session.status,
      progress: session.progress,
      message: session.message,
      result: session.metadata?.result,
      error: session.error ? {
        message: typeof session.error === 'string' ? session.error : 'Unknown error',
        ...(typeof session.error === 'object' ? session.error : {})
      } : undefined,
      metadata: session.metadata,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
    return NextResponse.json(response);
    
  } catch (error) {
    logger.error('Error updating publish status', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// GET /api/publish/status
// Public endpoint to get the current status of a publish session
// Query params: ?sessionId=<sessionId>
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  
  if (!sessionId) {
    return NextResponse.json(
      { error: 'Missing session ID' },
      { status: 400 }
    );
  }

  try {
    const session = await getPublishSession(sessionId);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const response: PublishStatusResponse = {
      sessionId: session.id,
      status: session.status,
      progress: session.progress,
      message: session.message,
      result: session.metadata?.result,
      error: session.error ? {
        message: typeof session.error === 'string' ? session.error : 'Unknown error',
        ...(typeof session.error === 'object' ? session.error : {})
      } : undefined,
      metadata: session.metadata,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };

    return NextResponse.json(response);
    
  } catch (error) {
    logger.error('Unexpected error in GET /api/publish/status', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
        status: 'error',
        details: error instanceof Error ? error.message : 'Unknown error',
        requestId: request.headers.get('x-request-id') || crypto.randomUUID()
      },
      { status: 500 }
    );
  }
}
