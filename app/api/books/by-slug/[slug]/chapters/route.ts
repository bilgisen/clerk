// app/api/books/by-slug/[slug]/chapters/route.ts
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { requireAuth } from '@/lib/auth/api-auth';

// Create a Neon client
const sql = neon(process.env.DATABASE_URL!);

// Route Segment Config
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

// GET: Get all chapters for a book by slug
export async function GET(
  request: Request,
  context: { params: { slug: string } }
) {
  try {
    const { user: authUser, error } = await requireAuth();
    if (error) return error;
    
    if (!authUser) {
      return NextResponse.json(
        { error: 'Authentication required' }, 
        { status: 401 }
      );
    }

    const { slug } = context.params;
    if (!slug) {
      return NextResponse.json(
        { error: 'Book slug is required' },
        { status: 400 }
      );
    }

    // Get the book by slug and user ID
    const [book] = await sql`
      SELECT id 
      FROM books 
      WHERE slug = ${slug} 
        AND user_id = ${authUser.id} 
      LIMIT 1`;

    if (!book) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      );
    }

    // Get all chapters for the book
    const chapters = await sql`
      SELECT * 
      FROM chapters 
      WHERE book_id = ${book.id} 
      ORDER BY \`order\` ASC`;

    return NextResponse.json(chapters);
  } catch (error) {
    console.error('Error fetching chapters:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Create a new chapter for a book by slug
export async function POST(
  request: Request,
  context: { params: { slug: string } }
) {
  try {
    const { user: authUser, error } = await requireAuth();
    if (error) return error;
    
    if (!authUser) {
      return NextResponse.json(
        { error: 'Authentication required' }, 
        { status: 401 }
      );
    }

    const { slug } = context.params;
    if (!slug) {
      return NextResponse.json(
        { error: 'Book slug is required' },
        { status: 400 }
      );
    }

    // Get the book by slug and user ID
    const [book] = await sql`
      SELECT id 
      FROM books 
      WHERE slug = ${slug} 
        AND user_id = ${authUser.id} 
      LIMIT 1`;

    if (!book) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      );
    }

    // Get the request body
    const body = await request.json();
    const { title, content, parentChapterId, order } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'Chapter title is required' },
        { status: 400 }
      );
    }

    // Create the new chapter
    const [newChapter] = await sql`
      INSERT INTO chapters 
        (book_id, title, content, parent_chapter_id, \`order\`, level, word_count, reading_time, excerpt)
      VALUES (
        ${book.id}, 
        ${title}, 
        ${content || null}, 
        ${parentChapterId || null}, 
        ${order || 0}, 
        ${parentChapterId ? 1 : 0}, 
        ${content ? content.split(/\s+/).length : 0}, 
        ${content ? Math.ceil(content.split(/\s+/).length / 200) : null}, 
        ${content ? content.substring(0, 200) : null}
      )
      RETURNING *`;

    return NextResponse.json(newChapter, { status: 201 });
  } catch (error) {
    console.error('Error creating chapter:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
