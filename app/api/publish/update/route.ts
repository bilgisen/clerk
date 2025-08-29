import { NextResponse, type NextRequest } from "next/server";
import { withGithubOidcAuth } from '@/middleware/auth';
import { updatePublishProgress, completePublishSession, failPublishSession } from '@/lib/publish/session-utils';

export const dynamic = 'force-dynamic';

export interface UpdatePublishRequest {
  status: 'in-progress' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  phase?: string;
  result?: Record<string, unknown>;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Get auth context from the request
    const authContext = request.authContext;
    
    if (!authContext || authContext.type !== 'github-oidc') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the session using the session ID from the request body
    const { sessionId, ...updateData } = await request.json() as UpdatePublishRequest & { sessionId: string };

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing session ID' },
        { status: 400 }
      );
    }

    let updatedSession;

    switch (updateData.status) {
      case 'in-progress':
        updatedSession = await updatePublishProgress(
          sessionId,
          updateData.progress || 0,
          updateData.message,
          updateData.phase
        );
        break;

      case 'completed':
        if (!updateData.result) {
          return NextResponse.json(
            { error: 'Result is required for completed status', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }
        updatedSession = await completePublishSession(
          sessionId,
          updateData.result,
          updateData.message
        );
        break;

      case 'failed':
        if (!updateData.error) {
          return NextResponse.json(
            { error: 'Error details are required for failed status', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }
        updatedSession = await failPublishSession(
          sessionId,
          updateData.error.message,
          updateData.error.code
        );
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid status value', code: 'VALIDATION_ERROR' },
          { status: 400 }
        );
    }

    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error('Error updating publish session:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update publish session',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
