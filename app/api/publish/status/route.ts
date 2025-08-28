import { NextResponse } from 'next/server';
import { getSession, updateSession, PublishStatus } from '@/lib/store/redis';
import { withGithubOidcAuth } from '@/middleware/auth';
import { logger } from '@/lib/logger';
import type { NextRequest } from 'next/server';

// Type definitions for the publish session
type PublishSession = {
  id: string;
  userId: string;
  status: PublishStatus;
  progress?: number;
  message?: string;
  phase?: string;
  result?: {
    epubUrl?: string;
    [key: string]: any;
  };
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  metadata?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
};

type PublishStatusResponse = {
  sessionId: string;
  status: PublishStatus;
  progress?: number;
  message?: string;
  phase?: string;
  result?: any;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
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
  metadata?: Record<string, any>;
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
    const { status, message } = await request.json();
    
    // Validate required fields
    if (!status) {
      return NextResponse.json(
        { error: 'Status is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }
    // Update the session in Redis with valid fields
    const updateData = {
      status: status as PublishStatus, // Cast to PublishStatus to ensure type safety
      ...(message && { message }), // Only include message if it exists
      metadata: {
        updatedBy: 'github-oidc',
        updatedAt: new Date().toISOString(),
        runId,
        repository
      }
    };
    
    logger.info('Updating publish status', { 
      status,
      runId,
      repository,
      userId
    });
    
    const updated = await updateSession(userId, updateData);

    if (!updated) {
      logger.error('Failed to update publish status', { 
        status,
        userId,
        runId
      });
      
      return NextResponse.json(
        { 
          error: 'Session not found or update failed',
          code: 'SESSION_UPDATE_FAILED'
        },
        { status: 404 }
      );
    }

    logger.info('Publish status updated', { 
      status,
      userId,
      runId,
      sessionId: updated.id
    });
    
    return NextResponse.json({ 
      success: true,
      sessionId: updated.id,
      status: updated.status
    });
  } catch (error) {
    console.error('Error updating publish status:', error);
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
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    
    // Validate session ID
    if (!sessionId) {
      return NextResponse.json(
        { 
          error: 'Session ID is required', 
          code: 'VALIDATION_ERROR',
          status: 'invalid_request'
        },
        { status: 400 }
      );
    }
    
    logger.info('Fetching publish status', { sessionId });
    
    try {
      // Get the session from Redis
      const session = await getSession(sessionId);
      
      if (!session) {
        logger.warn('Publish session not found', { sessionId });
        return NextResponse.json(
          { 
            error: 'Publish session not found or expired',
            code: 'SESSION_NOT_FOUND',
            status: 'not_found'
          },
          { status: 404 }
        );
      }
      
      // Validate session data
      if (!session.updatedAt || !session.createdAt) {
        logger.error('Invalid session data', { sessionId, session });
        return NextResponse.json(
          { 
            error: 'Invalid session data',
            code: 'INVALID_SESSION_DATA',
            status: 'error'
          },
          { status: 500 }
        );
      }
      
      // Check if the session is expired
      const now = Date.now();
      const sessionAge = now - session.updatedAt;
      const sessionTtl = ['completed', 'failed', 'aborted'].includes(session.status || '')
        ? 7 * 24 * 60 * 60 * 1000 // 7 days for completed/failed sessions
        : 24 * 60 * 60 * 1000; // 24 hours for active sessions
      
      if (sessionAge > sessionTtl) {
        logger.warn('Publish session expired', { 
          sessionId,
          age: sessionAge,
          ttl: sessionTtl,
          status: session.status
        });
        
        return NextResponse.json(
          { 
            error: 'Publish session expired',
            code: 'SESSION_EXPIRED',
            status: 'expired',
            expiredAt: new Date(session.updatedAt + sessionTtl).toISOString()
          },
          { status: 410 } // Gone
        );
      }
      
      // Prepare response data with type safety
      const responseData: PublishStatusResponse = {
        sessionId: session.id,
        status: session.status,
        progress: session.progress,
        message: session.message,
        phase: session.phase,
        result: session.result,
        error: session.error,
        metadata: session.metadata,
        createdAt: new Date(session.createdAt).toISOString(),
        updatedAt: new Date(session.updatedAt).toISOString(),
      };
      
      logger.debug('Publish status retrieved', { 
        sessionId,
        status: session.status,
        progress: session.progress
      });
      
      return NextResponse.json(responseData);
      
    } catch (redisError) {
      logger.error('Redis error fetching session', { 
        sessionId, 
        error: redisError instanceof Error ? redisError.message : 'Unknown Redis error'
      });
      
      return NextResponse.json(
        { 
          error: 'Failed to retrieve session data',
          code: 'STORAGE_ERROR',
          status: 'error',
          details: redisError instanceof Error ? redisError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
    
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
