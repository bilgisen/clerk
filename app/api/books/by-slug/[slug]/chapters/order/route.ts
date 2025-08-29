import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { updateChapterOrder } from '@/actions/books/chapters/update-chapter-order';

export async function PUT(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    
    // Verify authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    
    // Validate request body
    if (!body.chapters || !Array.isArray(body.chapters)) {
      return NextResponse.json(
        { error: 'Invalid request body. Expected { chapters: ChapterOrderUpdate[] }' },
        { status: 400 }
      );
    }

    // Call the server action
    const result = await updateChapterOrder(body.chapters, slug);

    if (!result.success) {
      type ErrorResponse = {
        error: string;
        details?: unknown;
        status?: number;
      };
      
      return NextResponse.json(
        { error: result.error, details: (result as ErrorResponse).details },
        { status: (result as ErrorResponse).status || 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating chapter order:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Add TypeScript type for the request body
type ChapterOrderUpdate = {
  id: string;
  order: number;
  level: number;
  parent_chapter_id: string | null;
};
