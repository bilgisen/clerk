import { NextResponse, type NextRequest } from "next/server";
import { withGithubOidcAuth } from "@/middleware/auth";
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
  context?: {
    params?: Record<string, string>;
    authContext: {
      type: 'github-oidc';
      repository: string;
      workflow: string;
      run_id: string;
      run_number?: string;
      sha?: string;
    };
  }
) {
  try {
    const { authContext } = context;
    
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
    
    // Get and validate the session
    const session = await getSession(sessionId);
    if (!session || session.status !== "pending-runner" || session.nonce !== nonce) {
      logger.warn('Invalid session or nonce', { 
        sessionExists: !!session, 
        sessionStatus: session?.status,
        nonceMatch: session?.nonce === nonce 
      });
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
        run_id: authContext.run_id,
        workflow: authContext.workflow,
        ...(authContext.run_number && { run_number: authContext.run_number.toString() }),
        ...(authContext.sha && { sha: authContext.sha })
      }
    };
    
    // Update the session with GitHub context
    await updateSession(sessionId, updateData);
    
    logger.info('Successfully attested GitHub Actions runner', {
      sessionId,
      repository: authContext.repository,
      workflow: authContext.workflow,
      runId: authContext.run_id
    });
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Attestation error', {
      error: errorMessage,
      stack: errorStack,
      sessionId: (error as any)?.sessionId
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
export const POST = withGithubOidcAuth(handler);
