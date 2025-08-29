import { NextResponse, type NextRequest } from "next/server";
import { 
  withGithubOidcAuth, 
  type HandlerWithAuth, 
  type GitHubOidcAuthContext
} from "@/middleware/auth";
import { getSession, updateSession, type PublishStatus } from "@/lib/store/redis";
import { logger } from "@/lib/logger";
import type { SessionUpdateData } from "@/lib/store/types";

// Type for the request body
type AttestRequest = {
  sessionId: string;
  nonce: string;
};


async function handler(
  req: NextRequest,
  context: {
    params?: Record<string, string>;
    authContext: GitHubOidcAuthContext;
  }
) {
  const authContext = context.authContext;
  try {
    // authContext is now properly typed as GitHubOidcAuthContext
    
    // Parse request body
    const { sessionId, nonce } = (await req.json()) as AttestRequest;
    
    // Validate required fields
    if (!sessionId || !nonce) {
      logger.warn('Missing required fields in attest request', { sessionId: !!sessionId, hasNonce: !!nonce });
      return NextResponse.json(
        { error: "Missing required fields", code: "MISSING_FIELDS" },
        { status: 400 }
      );
    }
    
    // Log the attestation
    logger.info('Attesting GitHub Actions runner', {
      sessionId,
      repository: authContext.repository,
      runId: authContext.runId,
      workflow: authContext.workflow,
      actor: authContext.actor
    });

    // Get the session
    const session = await getSession(sessionId);
    if (!session || session.nonce !== nonce) {
      logger.warn('Invalid session or nonce', { sessionId, hasSession: !!session });
      return NextResponse.json(
        { error: "Invalid session or nonce", code: "INVALID_SESSION" },
        { status: 400 }
      );
    }
    
    // Prepare session update
    const updateData: SessionUpdateData = {
      status: 'runner-attested',
      gh: {
        repository: authContext.repository,
        run_id: authContext.runId, // Using runId but mapping to run_id for the session
        workflow: authContext.workflow,
        run_number: '1', 
        sha: authContext.sha,
        // Removed actor, ref, and repository_owner as they're not in the expected type
      }
    };
    
    // Update the session with GitHub context
    await updateSession(sessionId, updateData);
    
    logger.info('Successfully attested GitHub Actions runner', {
      sessionId,
      repository: authContext.repository,
      workflow: authContext.workflow,
      runId: authContext.runId
    });
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Attestation error', {
      error: errorMessage,
      stack: errorStack,
      sessionId: error && typeof error === 'object' && 'sessionId' in error 
        ? String(error.sessionId) 
        : undefined
    });
    
    return NextResponse.json(
      { 
        error: `Attestation failed: ${errorMessage}`, 
        code: "ATTESTATION_FAILED",
        ...(process.env.NODE_ENV === 'development' && { details: errorStack })
      },
      { status: 500 }
    );
  }
}

// Export the handler wrapped with GitHub OIDC auth middleware
export const POST = withGithubOidcAuth(handler as unknown as HandlerWithAuth);
