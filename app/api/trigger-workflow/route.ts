import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { GitHubActionsService } from '@/lib/services/github-actions.service';

// We centralize GitHub workflow triggering in GitHubActionsService

export async function POST(request: Request) {
  try {
    // Authenticate the user
    const session = await auth();
    if (!session || !session.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const userId = session.userId;

    // Parse request body
    const { content_id, format, metadata } = await request.json();
    
    if (!content_id) {
      return NextResponse.json(
        { error: 'content_id is required' },
        { status: 400 }
      );
    }

    const result = await GitHubActionsService.triggerContentProcessing({
      contentId: content_id.toString(),
      format: format || 'epub',
      metadata: {
        ...(metadata || {}),
        user_id: userId,
      },
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error triggering workflow:', error);
    return NextResponse.json(
      { 
        error: 'Failed to trigger workflow',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
