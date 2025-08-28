import { NextResponse } from 'next/server';
import { verifyCombinedToken } from '@/lib/auth/combined';
import { getSession, updateSession, PublishStatus } from '@/lib/store/redis';
import { withPublishAuth } from '@/lib/auth/withPublishAuth';

export const dynamic = 'force-dynamic';

type StatusUpdate = {
  phase: string;
  message?: string;
  progress?: number;
  metadata?: Record<string, any>;
};

// Protected route that requires OIDC token
export const POST = withPublishAuth(async (request, _, claims) => {
  // Ensure this is an OIDC-authenticated request
  if (claims.authType !== 'github-oidc') {
    return NextResponse.json(
      { error: 'This endpoint requires OIDC authentication' },
      { status: 401 }
    );
  }
  try {
    const { status, message } = await request.json();
    
    // Update the session in Redis with valid fields
    const updateData = {
      status: status as PublishStatus, // Cast to PublishStatus to ensure type safety
      ...(message && { message }), // Only include message if it exists
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
    console.error('Error updating publish status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Get the current status of a publish session (public endpoint)
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId query parameter is required' },
        { status: 400 }
      );
    }

    const session = await getSession(sessionId);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Return only the necessary session data
    const { id, status, message, progress, phase, result, error, createdAt, updatedAt } = session;
    return NextResponse.json({
      id,
      status,
      message,
      progress,
      phase,
      result,
      error,
      createdAt,
      updatedAt
    });
  } catch (error) {
    console.error('Error fetching publish status:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR' 
      },
      { status: 500 }
    );
  }
}
