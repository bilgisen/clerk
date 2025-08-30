import { type NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { generateCompleteDocumentHTML } from '@/lib/generateChapterHTML';

// Create a Neon client
const sql = neon(process.env.DATABASE_URL!);

// Define types for our database tables
interface Chapter {
  id: string;
  title: string;
  content: string | null;
  order: number | null;
  level: number | null;
  parent_chapter_id: string | null;
  book_id: string;
}

interface Book {
  id: string;
  title: string;
}

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

    // Fetch chapter with its book relation using raw SQL
    const [chapter] = (await sql`
      SELECT 
        c.*,
        json_build_object(
          'id', b.id,
          'title', b.title
        ) as book
      FROM chapters c
      LEFT JOIN books b ON c.book_id = b.id
      WHERE c.id = ${chapterId}
      LIMIT 1`
    ) as Array<Chapter & { book: Book }>;

    if (!chapter) {
      return NextResponse.json(
        { error: 'Chapter not found' },
        { status: 404 }
      );
    }

    // Convert the book from JSON string to object if needed
    const book = typeof chapter.book === 'string' ? JSON.parse(chapter.book) : chapter.book;

    // Generate HTML with complete metadata
    const html = generateCompleteDocumentHTML(
      chapter.title,
      chapter.content || '',
      {
        book: book?.title || 'Untitled Book',
        chapter_id: chapter.id,
        order: chapter.order || 0,
        level: chapter.level || 1,
        title_tag: `h${chapter.level || 1}`,
        title: chapter.title,
        parent_chapter: chapter.parent_chapter_id || ''
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
