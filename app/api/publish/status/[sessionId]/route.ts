import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/store/redis";
import { withGithubOidcAuth } from "@/middleware/auth";
import { logger } from "@/lib/logger";

export const dynamic = 'force-dynamic';

import type { AuthContextUnion } from '@/types/auth';

async function handler(
  request: NextRequest,
  context: {
    params?: { sessionId: string };
    authContext: AuthContextUnion;
  } = { authContext: { type: 'unauthorized' } }
) {
  const sessionId = context.params?.sessionId;
  
  if (!sessionId) {
    logger.error('Missing sessionId in request');
    return NextResponse.json(
      { error: "Missing session ID", code: "MISSING_SESSION_ID" },
      { status: 400 }
    );
  }
  const { authContext } = context;
  
  // Log the status check
  logger.info('Status check for session', {
    sessionId,
    repository: authContext.type === 'github-oidc' ? authContext.repository : undefined,
    workflow: authContext.type === 'github-oidc' ? authContext.workflow : undefined,
    run_id: authContext.type === 'github-oidc' ? authContext.run_id : undefined
  });
  
  try {
    // Get the latest session data
    const currentSession = await getSession(sessionId);
    if (!currentSession) {
      logger.warn('Session not found', { sessionId });
      return NextResponse.json(
        { error: "Session not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }
    
    // Log successful status retrieval
    logger.debug('Session status retrieved', {
      sessionId,
      status: currentSession.status,
      progress: currentSession.progress
    });
    
    // Return session status
    return NextResponse.json({
      sessionId: currentSession.id,
      status: currentSession.status,
      contentId: currentSession.contentId,
      progress: currentSession.progress,
      message: currentSession.message,
      phase: currentSession.phase,
      gh: currentSession.gh,
      createdAt: currentSession.createdAt,
      updatedAt: currentSession.updatedAt,
      completedAt: currentSession.completedAt,
      result: currentSession.result,
      error: currentSession.error
    });
  } catch (error) {
    logger.error('Error getting session status', {
      error: error instanceof Error ? error.message : 'Unknown error',
      sessionId,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// Export the handler wrapped with GitHub OIDC auth middleware
// Type assertion to handle the params type difference
const typedHandler = handler as (
  request: NextRequest,
  context: { params?: Record<string, string>; authContext: AuthContextUnion }
) => Promise<NextResponse>;

export const GET = withGithubOidcAuth(typedHandler);
