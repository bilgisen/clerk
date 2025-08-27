import { NextResponse } from 'next/server';
import { withPublishAuth } from '@/lib/auth/withPublishAuth';
import { updateSession, PublishSession } from '@/lib/store/redis';

export const dynamic = 'force-dynamic';

type FinalizeRequest = {
  success: boolean;
  message?: string;
  result?: {
    artifactUrl?: string;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
  };
  error?: {
    message: string;
    code?: string;
    [key: string]: unknown;
  };
};

export const POST = withPublishAuth(async (request, _, claims) => {
  try {
    const { success, result, error } = (await request.json()) as FinalizeRequest;
    
    // Update the session in Redis as completed
    const updateData: Partial<PublishSession> = {
      status: success ? 'completed' : 'failed',
      completedAt: Date.now(),
      updatedAt: Date.now(),
      ...(success ? { result } : { error })
    };
    
    const updated = await updateSession(claims.sid, updateData);

    if (!updated) {
      return NextResponse.json(
        { error: 'Session not found or update failed' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error finalizing publish:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { 
          error: error.message,
          code: 'FINALIZE_ERROR',
          success: false 
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
        success: false
      },
      { status: 500 }
    );
  }
});
