// app/api/books/by-slug/[slug]/chapters/route.ts
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { neon } from '@neondatabase/serverless';

// Create a Neon client
const sql = neon(process.env.DATABASE_URL!);

// Define types for our database tables
interface User {
  id: string;
  clerk_id: string;
}

interface Book {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  genre: string | null;
  language: string | null;
  isbn: string | null;
  view_count: number;
  is_published: boolean;
  is_featured: boolean;
}

interface Chapter {
  id: string;
  book_id: string;
  title: string;
  content: string | null;
  parent_chapter_id: string | null;
  "order": number;
  level: number;
  word_count: number | null;
  reading_time: number | null;
  created_at: Date;
  updated_at: Date;
  excerpt: string | null;
}

/**
 * GET /api/books/by-slug/[slug]/chapters
 * Get all chapters for a book by slug
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    
    // Ensure user is authenticated with Clerk
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' }, 
        { status: 401 }
      );
    }

    // Find user using raw SQL with proper type safety
    const [dbUser] = (await sql`
      SELECT id, clerk_id 
      FROM users 
      WHERE clerk_id = ${user.id} 
      LIMIT 1`
    ) as User[];

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    // Verify the book exists and belongs to the user
    const [book] = (await sql`
      SELECT * 
      FROM books 
      WHERE slug = ${slug} 
        AND user_id = ${dbUser.id} 
      LIMIT 1`
    ) as Book[];

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // Get all chapters for the book
    const allChapters = (await sql`
      SELECT * 
      FROM chapters 
      WHERE book_id = ${book.id}
      ORDER BY "order" ASC`
    ) as Chapter[];

    // Define the chapter type with children
    type ChapterWithChildren = Chapter & {
      children: ChapterWithChildren[];
    };

    // Create a type-safe filter function
    const filterChapters = (chaptersList: Chapter[], parentId: string | null) => {
      return chaptersList.filter(chapter => 
        (parentId === null && !chapter.parent_chapter_id) || 
        (chapter.parent_chapter_id === parentId)
      );
    };

    // Build the chapter tree
    const buildChapterTree = (chaptersList: Chapter[], parentId: string | null = null): ChapterWithChildren[] => {
      return filterChapters(chaptersList, parentId).map(chapter => ({
        ...chapter,
        children: buildChapterTree(chaptersList, chapter.id)
      }));
    };

    const chapterTree = buildChapterTree(allChapters);
    return NextResponse.json(chapterTree);
  } catch (error) {
    console.error('Error in GET /api/books/by-slug/[slug]/chapters:', error);
    return NextResponse.json(
      { 
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

/**
 * POST /api/books/by-slug/[slug]/chapters
 * Create a new chapter for a book by slug
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    
    // Ensure user is authenticated with Clerk
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' }, 
        { status: 401 }
      );
    }

    // Find user using raw SQL with proper type safety
    const [dbUser] = (await sql`
      SELECT id, clerk_id 
      FROM users 
      WHERE clerk_id = ${user.id} 
      LIMIT 1`
    ) as User[];

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    // Verify the book exists and belongs to the user
    const [book] = (await sql`
      SELECT id, user_id 
      FROM books 
      WHERE slug = ${slug} 
        AND user_id = ${dbUser.id} 
      LIMIT 1`
    ) as { id: string; user_id: string }[];

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    const body = await request.json();
    const { title, content, parentChapterId, order, level } = body as {
      title: string;
      content?: string;
      parentChapterId?: string | null;
      order?: number;
      level?: number;
    };

    if (!title) {
      return NextResponse.json(
        { error: 'Chapter title is required' }, 
        { status: 400 }
      );
    }

    // Calculate word count and reading time
    const wordCount = content ? content.trim().split(/\s+/).length : 0;
    const readingTime = content ? Math.ceil(wordCount / 200) : 0; // Assuming 200 words per minute
    const excerpt = content ? content.substring(0, 160) : null; // First 160 chars as excerpt

    // Create the new chapter
    const [newChapter] = (await sql`
      INSERT INTO chapters (
        book_id, 
        title, 
        content, 
        parent_chapter_id, 
        "order", 
        level, 
        word_count, 
        reading_time, 
        excerpt
      )
      VALUES (
        ${book.id}, 
        ${title}, 
        ${content ?? null}, 
        ${parentChapterId ?? null}, 
        ${order ?? 0}, 
        ${level ?? 0}, 
        ${wordCount}, 
        ${readingTime}, 
        ${excerpt}
      )
      RETURNING *`
    ) as Chapter[];

    return NextResponse.json(newChapter, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/books/by-slug/[slug]/chapters:', error);
    return NextResponse.json(
      { 
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}
