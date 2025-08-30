import { NextResponse, type NextRequest } from 'next/server';
import { GitHubActionsService } from '@/lib/services/github-actions.service';
import { getAuth } from '@clerk/nextjs/server';
import { logger } from '@/lib/logger';
import { db } from '@/db';
import { books } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Type definitions for the request and response
type PublishOptions = {
  includeMetadata: boolean;
  includeCover: boolean;
  includeTOC: boolean;
  tocLevel: number;
  includeImprint: boolean;
};

type TriggerWorkflowRequest = {
  bookId: string;
  options: PublishOptions;
  metadata?: Record<string, unknown>;
};

type TriggerWorkflowResponse = {
  success: boolean;
  workflowRunId?: string;
  workflowUrl?: string;
  sessionId?: string;
  error?: string;
  code?: string;
  details?: unknown;
};

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  try {
    logger.info('Triggering workflow', { requestId });
    
    // Get the authenticated user
    const { userId } = getAuth(request);
    
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

    const { bookId, options, metadata = {} } = requestBody;

    if (!bookId) {
      logger.warn('Missing bookId in request', { requestId });
      return NextResponse.json(
        { 
          success: false,
          error: 'Book ID is required',
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }
    
    // Validate options
    if (!options || typeof options !== 'object') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid options provided',
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    logger.info('Triggering EPUB generation', { 
      requestId, 
      bookId,
      userId,
      options
    });

    // Trigger the GitHub Actions workflow
    const workflowResponse = await GitHubActionsService.triggerWorkflow({
      bookId,
      options,
      userId,
      metadata: {
        ...metadata,
        requestId,
        timestamp: new Date().toISOString(),
        userAgent: request.headers.get('user-agent'),
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
      }
    });

    if (!workflowResponse.success) {
      logger.error('Failed to trigger workflow', { 
        requestId, 
        error: workflowResponse.error
      });
      
      return NextResponse.json(
        { 
          success: false,
          error: workflowResponse.error || 'Failed to trigger workflow',
          code: 'WORKFLOW_TRIGGER_FAILED'
        },
        { status: 500 }
      );
    }

    // Log successful workflow trigger
    logger.info('Successfully triggered GitHub Actions workflow', {
      requestId,
      bookId,
      workflowRunId: workflowResponse.workflowRunId,
      workflowUrl: workflowResponse.workflowUrl,
      triggeredAt: workflowResponse.triggeredAt
    });

    // Save workflow ID to the database
    if (workflowResponse.workflowRunId) {
      try {
        await db.update(books)
          .set({ 
            workflowId: workflowResponse.workflowRunId,
            updatedAt: new Date()
          })
          .where(eq(books.id, bookId));
        
        logger.info('Updated book with workflow ID', { 
          requestId,
          bookId,
          workflowRunId: workflowResponse.workflowRunId 
        });
      } catch (dbError) {
        logger.error('Failed to update book with workflow ID', { 
          requestId,
          bookId,
          error: dbError,
          workflowRunId: workflowResponse.workflowRunId
        });
        // Continue even if database update fails
      }
    }

    const response: TriggerWorkflowResponse = {
      success: true,
      workflowRunId: workflowResponse.workflowRunId,
      workflowUrl: workflowResponse.workflowUrl
    };

    logger.info('Workflow triggered successfully', { 
      requestId, 
      workflowRunId: workflowResponse.workflowRunId,
      workflowUrl: workflowResponse.workflowUrl,
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
