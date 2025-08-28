import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { verifyGithubOidc } from '@/lib/auth/github-oidc';
import { generateCombinedToken } from '@/lib/auth/combined-token';
import { getSession, updateSession, createSession } from '@/lib/store/redis';
import { v4 as uuidv4 } from 'uuid';
import type { PublishStatus } from '@/lib/store/redis';
import { logger } from '@/lib/logger';

// Using PublishSession type from redis.ts

const AUDIENCE = process.env.COMBINED_JWT_AUDIENCE || 'clerk-actions';
const DEFAULT_TTL = 15 * 60; // 15 minutes in seconds

interface TokenRequest {
  sessionId?: string;  // For GitHub OIDC flow
  contentId?: string;  // For direct user token generation
  permissions?: {
    can_publish?: boolean;
    can_generate?: boolean;
    can_manage?: boolean;
  };
  metadata?: Record<string, unknown>;
  nonce?: string;     // For session validation
}

interface TokenResponse {
  token: string;
  session: {
    id: string;
    status: PublishStatus;
    contentId: string;
    progress?: number;
    message?: string;
    gh?: {
      repository?: string;
      run_id?: string;
      workflow?: string;
      sha?: string;
    };
  };
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const requestBody = await request.json() as TokenRequest;

  // Check for GitHub OIDC flow
  if (authHeader?.startsWith('Bearer ')) {
    try {
      // Verify GitHub OIDC token
      const idToken = authHeader.split(' ')[1];
      const claims = await verifyGithubOidc(idToken);
      
      if (!requestBody.sessionId) {
        return new Response('Missing session_id in request body', { status: 400 });
      }

      const privateKey = process.env.COMBINED_JWT_PRIVATE_KEY;
      if (!privateKey) {
        logger.error('COMBINED_JWT_PRIVATE_KEY is not set');
        return new Response('Server configuration error', { status: 500 });
      }

      // Get the publish session
      const session = await getSession(requestBody.sessionId);
      if (!session) {
        return new Response('Session not found', { status: 404 });
      }

      // Verify the nonce matches the GitHub run ID
      if (session.nonce !== claims.run_id) {
        return new Response('Invalid nonce', { status: 401 });
      }

      // Update session with GitHub context
      const sessionUpdate = {
        status: 'runner-attested' as PublishStatus,
        gh: {
          repository: claims.repository,
          run_id: claims.run_id,
          run_number: claims.run_number,
          workflow: claims.workflow,
          sha: claims.sha,
        },
        updatedAt: Date.now(),
      };
      
      const updatedSession = await updateSession(requestBody.sessionId, sessionUpdate);

      if (!updatedSession) {
        return new Response('Failed to update session', { status: 500 });
      }

      // Generate combined token for GitHub Actions
      const token = await generateCombinedToken(
        {
          sessionId: updatedSession.id,
          userId: updatedSession.userId,
          contentId: updatedSession.contentId,
          nonce: updatedSession.nonce,
          tokenType: 'ci' as const,
          permissions: {
            can_publish: true,
            can_generate: true,
            can_manage: false,
          },
          gh: {
            repository: claims.repository,
            run_id: claims.run_id,
            run_number: claims.run_number,
            workflow: claims.workflow,
            sha: claims.sha,
            actor: claims.actor,
            event_name: claims.event_name,
            ref: claims.ref,
            head_ref: claims.head_ref,
            base_ref: claims.base_ref,
          },
          metadata: updatedSession.metadata,
          status: updatedSession.status,
          progress: updatedSession.progress,
          phase: updatedSession.phase,
          message: updatedSession.message
        },
        AUDIENCE,
        DEFAULT_TTL
      );

      if (!token) {
        logger.error('Failed to generate token');
        return new Response('Failed to generate token', { status: 500 });
      }

      return NextResponse.json({
        token,
        session: {
          id: updatedSession.id,
          status: updatedSession.status,
          contentId: updatedSession.contentId,
          progress: updatedSession.progress,
          message: updatedSession.message,
          gh: updatedSession.gh,
        }
      });
    } catch (error) {
      console.error('GitHub OIDC flow failed:', error);
      return NextResponse.json(
        { 
          error: 'GitHub OIDC authentication failed',
          details: process.env.NODE_ENV === 'development' ? error : undefined
        },
        { status: 401 }
      );
    }
  }

  // Handle Clerk user authentication flow
  try {
    const session = await auth();
    if (!session?.userId) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    const privateKey = process.env.COMBINED_JWT_PRIVATE_KEY;
    if (!privateKey) {
      logger.error('COMBINED_JWT_PRIVATE_KEY is not set');
      return new Response('Server configuration error', { status: 500 });
    }

    if (!requestBody.contentId) {
      return new Response('contentId is required', { status: 400 });
    }

    // Create a new session for user-initiated actions
    const sessionId = `sess_${uuidv4()}`;
    const newSession = await createSession({
      id: sessionId,
      userId: session.userId,
      contentId: requestBody.contentId!,
      status: 'pending-runner' as PublishStatus,
      nonce: uuidv4(),
      metadata: {
        ...(requestBody.metadata || {}),
        permissions: {
          can_publish: requestBody.permissions?.can_publish ?? false,
          can_generate: requestBody.permissions?.can_generate ?? true,
          can_manage: requestBody.permissions?.can_manage ?? false,
        },
      }
    });

    if (!newSession) {
      logger.error('Failed to create session');
      return new Response('Failed to create session', { status: 500 });
    }

    // Generate combined token for the user
    const token = await generateCombinedToken(
      {
        sessionId: newSession.id,
        userId: newSession.userId,
        contentId: newSession.contentId,
        nonce: newSession.nonce,
        tokenType: 'user' as const,
        permissions: newSession.metadata?.permissions || {
          can_publish: false,
          can_generate: true,
          can_manage: false,
        },
        metadata: newSession.metadata,
        status: newSession.status,
        gh: newSession.gh,
        progress: newSession.progress,
        phase: newSession.phase,
        message: newSession.message
      },
      AUDIENCE,
      DEFAULT_TTL
    );

    const response: TokenResponse = {
      token,
      session: {
        id: sessionId,
        status: newSession.status,
        contentId: newSession.contentId,
        progress: newSession.progress,
        message: newSession.message,
        gh: newSession.gh,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('User token generation failed:', { error: errorMessage });
    
    return NextResponse.json(
      { 
        error: 'Failed to generate user token',
        message: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}

// Token verification is handled by the verify-token endpoint
export async function GET() {
  return new Response('Use POST method to generate a token', { status: 405 });
}
