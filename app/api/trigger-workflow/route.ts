import { NextResponse } from 'next/server';
import { GitHubActionsService } from '@/lib/services/github-actions.service';
import { getAuth } from '@clerk/nextjs/server';
import { logger } from '@/lib/logger';

// Type definitions for the request and response
type TriggerWorkflowRequest = {
  contentId: string;
  metadata?: Record<string, any>;
};

type TriggerWorkflowResponse = {
  success: boolean;
  workflowRunId?: string;
  workflowUrl?: string;
  sessionId?: string;
  error?: string;
  code?: string;
  details?: any;
};

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  try {
    logger.info('Triggering workflow', { requestId });
    
    // Get the authenticated user
    const { userId } = getAuth(request as any);
    
    if (!userId) {
      logger.warn('Unauthorized workflow trigger attempt', { requestId });
      return NextResponse.json(
        { 
          success: false,
          error: 'Unauthorized',
          code: 'UNAUTHORIZED'
        },
        { status: 401 }
      );
    }

    // Parse and validate request body
    let requestBody: TriggerWorkflowRequest;
    try {
      requestBody = await request.json();
    } catch (error) {
      logger.error('Invalid request body', { requestId, error });
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid request body',
          code: 'INVALID_REQUEST'
        },
        { status: 400 }
      );
    }

    const { contentId, metadata = {} } = requestBody;

    if (!contentId) {
      logger.warn('Missing contentId in request', { requestId });
      return NextResponse.json(
        { 
          success: false,
          error: 'Content ID is required',
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    logger.info('Initializing publish session', { 
      requestId, 
      contentId,
      userId 
    });

    // First, initialize a publish session
    const initResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/publish/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'X-Request-ID': requestId
      },
      body: JSON.stringify({
        contentId,
        metadata: {
          ...metadata,
          userId,
          requestId,
          timestamp: new Date().toISOString(),
          userAgent: request.headers.get('user-agent'),
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
        }
      })
    });

    if (!initResponse.ok) {
      const error = await initResponse.json().catch(() => ({}));
      logger.error('Failed to initialize publish session', { 
        requestId, 
        status: initResponse.status,
        error 
      });
      
      return NextResponse.json(
        { 
          success: false,
          error: error.message || 'Failed to initialize publish session',
          code: error.code || 'SESSION_INIT_FAILED',
          details: error.details
        },
        { status: initResponse.status || 500 }
      );
    }

    const { sessionId, nonce } = await initResponse.json();
    
    if (!sessionId || !nonce) {
      logger.error('Invalid session initialization response', { 
        requestId, 
        response: { sessionId, nonce } 
      });
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid session initialization response',
          code: 'INVALID_SESSION_RESPONSE'
        },
        { status: 500 }
      );
    }

    logger.info('Triggering GitHub Actions workflow', { 
      requestId, 
      contentId,
      sessionId,
      userId 
    });

    // Trigger the GitHub Actions workflow
    const result = await GitHubActionsService.triggerContentProcessing({
      contentId,
      sessionId,
      nonce,
      metadata: {
        ...metadata,
        userId,
        requestId,
        timestamp: new Date().toISOString()
      }
    });

    if (!result.success) {
      logger.error('Failed to trigger workflow', { 
        requestId, 
        error: result.error,
        sessionId 
      });
      
      return NextResponse.json(
        { 
          success: false,
          error: result.error || 'Failed to trigger workflow',
          code: 'WORKFLOW_TRIGGER_FAILED',
          sessionId
        },
        { status: 500 }
      );
    }

    const response: TriggerWorkflowResponse = {
      success: true,
      workflowRunId: result.workflowRunId,
      workflowUrl: result.workflowUrl,
      sessionId
    };

    logger.info('Workflow triggered successfully', { 
      requestId, 
      sessionId,
      workflowRunId: result.workflowRunId,
      duration: Date.now() - startTime
    });

    return NextResponse.json(response);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Error triggering workflow', { 
      requestId, 
      error: errorMessage,
      stack: errorStack,
      duration: Date.now() - startTime
    });
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to trigger workflow',
        code: 'INTERNAL_SERVER_ERROR',
        details: errorMessage,
        requestId
      },
      { status: 500 }
    );
  }
}
