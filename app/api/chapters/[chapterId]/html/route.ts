import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/drizzle';
import { chapters } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateCompleteDocumentHTML } from '@/lib/generateChapterHTML';

type RouteParams = {
  params: {
    chapterId: string;
  };
};

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { chapterId } = params;

    // Fetch chapter with its book relation
    const chapter = await db.query.chapters.findFirst({
      where: eq(chapters.id, chapterId),
      with: {
        book: true
      }
    });

    if (!chapter) {
      return NextResponse.json(
        { error: 'Chapter not found' },
        { status: 404 }
      );
    }

    // Generate HTML with complete metadata
    const html = generateCompleteDocumentHTML(
      chapter.title,
      chapter.content || '',
      {
        book: chapter.book?.title || 'Untitled Book',
        chapter_id: chapter.id,
        order: chapter.order || 0,
        level: chapter.level || 1,
        title_tag: `h${chapter.level || 1}`,
        title: chapter.title,
        parent_chapter: chapter.parentChapterId || undefined,
        // Add any other required properties from ChapterMetadata interface
      }
    );

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (error) {
    console.error('Failed to generate chapter HTML:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
