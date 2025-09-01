// app/api/books/by-slug/[slug]/chapters/[chapterId]/route.ts
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { requireAuth } from '@/lib/auth/api-auth';

// Create a Neon client
const sql = neon(process.env.DATABASE_URL!);

// Route Segment Config
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

// Disable body parsing for file uploads
export const maxDuration = 30; // 30 seconds

export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

// GET: Get a single chapter by ID for a book by slug
export async function GET(
  request: Request,
  context: { params: { slug: string; chapterId: string } }
) {
  try {
    const { user: authUser, error } = await requireAuth();
    if (error) return error;
    
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get params
    const { slug, chapterId } = context.params;
    if (!slug || !chapterId) {
      return NextResponse.json({ error: 'Book slug and chapter ID are required' }, { status: 400 });
    }

    // Find book using raw SQL
    const [book] = (await sql`
      SELECT id 
      FROM books 
      WHERE slug = ${slug} 
        AND user_id = ${authUser.id} 
      LIMIT 1`);

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // Find chapter using raw SQL
    const [chapter] = (await sql`
      SELECT * 
      FROM chapters 
      WHERE id = ${chapterId} 
        AND book_id = ${book.id} 
      LIMIT 1`);

    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    return NextResponse.json(chapter);
  } catch (error) {
    console.error('Error fetching chapter:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH: Update a chapter
export async function PATCH(
  request: Request,
  context: { params: { slug: string; chapterId: string } }
) {
  try {
    const { user: authUser, error } = await requireAuth();
    if (error) return error;
    
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { slug, chapterId } = context.params;
    if (!slug || !chapterId) {
      return NextResponse.json({ error: 'Book slug and chapter ID are required' }, { status: 400 });
    }

    // Find the book
    const [book] = (await sql`
      SELECT id 
      FROM books 
      WHERE slug = ${slug} 
        AND user_id = ${authUser.id} 
      LIMIT 1`);

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // Get the request body
    const body = await request.json();

    // Update the chapter
    const [updatedChapter] = await sql`
      UPDATE chapters 
      SET ${sql(body, ...Object.keys(body))}
      WHERE id = ${chapterId} 
        AND book_id = ${book.id}
      RETURNING *`;

    if (!updatedChapter) {
      return NextResponse.json({ error: 'Failed to update chapter' }, { status: 400 });
    }

    return NextResponse.json(updatedChapter);
  } catch (error) {
    console.error('Error updating chapter:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Delete a chapter
export async function DELETE(
  _req: Request,
  context: { params: { slug: string; chapterId: string } }
) {
  try {
    const { user: authUser, error } = await requireAuth();
    if (error) return error;
    
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { slug, chapterId } = context.params;
    if (!slug || !chapterId) {
      return NextResponse.json({ error: 'Book slug and chapter ID are required' }, { status: 400 });
    }

    // Find the book
    const [book] = (await sql`
      SELECT id 
      FROM books 
      WHERE slug = ${slug} 
        AND user_id = ${authUser.id} 
      LIMIT 1`);

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // Delete the chapter
    const [deletedChapter] = await sql`
      DELETE FROM chapters 
      WHERE id = ${chapterId} 
        AND book_id = ${book.id}
      RETURNING *`;

    if (!deletedChapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting chapter:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
