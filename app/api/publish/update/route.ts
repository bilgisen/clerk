import { NextResponse } from "next/server";
import { withPublishAuth } from "@/lib/auth/withPublishAuth";
import { updatePublishProgress, completePublishSession, failPublishSession } from "@/lib/session-utils";

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

export const POST = withPublishAuth(async (request, _, claims) => {
  try {
    // Ensure this is an OIDC-authenticated request
    if (claims.authType !== 'github-oidc') {
      return NextResponse.json(
        { error: 'This endpoint requires OIDC authentication' },
        { status: 401 }
      );
    }

    const { status, progress, message, phase, result, error } = 
      await request.json() as UpdatePublishRequest;

    if (!claims.sid) {
      return NextResponse.json(
        { error: "Invalid session ID in token", code: "INVALID_SESSION" },
        { status: 400 }
      );
    }

    const sessionId = claims.sid;
      let updatedSession;

      switch (status) {
        case 'in-progress':
          updatedSession = await updatePublishProgress(
            sessionId,
            progress || 0,
            message,
            phase
          );
          break;

        case 'completed':
          if (!result) {
            return NextResponse.json(
              { error: "Result is required for completed status", code: "VALIDATION_ERROR" },
              { status: 400 }
            );
          }
          updatedSession = await completePublishSession(
            sessionId,
            result,
            message
          );
          break;

        case 'failed':
          if (!error) {
            return NextResponse.json(
              { error: "Error details are required for failed status", code: "VALIDATION_ERROR" },
              { status: 400 }
            );
          }
          updatedSession = await failPublishSession(
            sessionId,
            new Error(error.message),
            message
          );
          break;

        default:
          return NextResponse.json(
            { error: "Invalid status", code: "VALIDATION_ERROR" },
            { status: 400 }
          );
      }

      if (!updatedSession) {
        throw new Error("Failed to update session");
      }

      return NextResponse.json({
        sessionId: updatedSession.id,
        status: updatedSession.status,
        progress: updatedSession.progress,
        message: updatedSession.message,
        phase: updatedSession.phase,
        updatedAt: updatedSession.updatedAt
      });

  } catch (error) {
    console.error("Publish update error:", error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { 
          error: error.message, 
          code: error.name === 'Error' ? 'UPDATE_ERROR' : error.name 
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
});
