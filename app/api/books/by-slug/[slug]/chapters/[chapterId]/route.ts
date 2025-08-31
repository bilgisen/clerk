// app/api/books/by-slug/[slug]/chapters/[chapterId]/route.ts
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { requireAuth } from '@/lib/auth/api-auth';

// Create a Neon client
const sql = neon(process.env.DATABASE_URL!);

// Define types for our database tables
interface User {
  id: string;
  clerk_id: string;
  // Add other user fields as needed
}

interface Book {
  id: string;
  slug: string;
  user_id: string;
  // Add other book fields as needed
}

interface Chapter {
  id: string;
  book_id: string;
  // Add other chapter fields as needed
}

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
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    // Await params before destructuring
    const { slug, chapterId } = await context.params;
    if (!slug || !chapterId) {
      return NextResponse.json({ error: 'Book slug and chapter ID are required' }, { status: 400 });
    }

    // Find user using raw SQL with proper type safety
    const [dbUser] = (await sql`
      SELECT id, clerk_id 
      FROM users 
      WHERE clerk_id = ${user.id} 
      LIMIT 1`
    ) as User[];
    
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Find book using raw SQL with proper type safety
    const [book] = (await sql`
      SELECT * 
      FROM books 
      WHERE slug = ${slug} 
        AND user_id = ${dbUser!.id} 
      LIMIT 1`
    ) as Book[];
    
    if (!book) return NextResponse.json({ error: 'Book not found' }, { status: 404 });

    // Find chapter using raw SQL with proper type safety
    const [chapter] = (await sql`
      SELECT * 
      FROM chapters 
      WHERE id = ${chapterId} 
        AND book_id = ${book!.id} 
      LIMIT 1`
    ) as Chapter[];
    
    if (!chapter) return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });

    // Return the chapter data
    return NextResponse.json(chapter);
    
  } catch (error) {
    console.error('Error in GET /api/books/by-slug/[slug]/chapters/[chapterId]:', error);
    return NextResponse.json(
      { 
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
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
    // Ensure user is authenticated with Clerk
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' }, 
        { status: 401 }
      );
    }

    const { slug, chapterId } = context.params;
    if (!slug || !chapterId) {
      return NextResponse.json(
        { error: 'Book slug and chapter ID are required' }, 
        { status: 400 }
      );
    }

    // Find user using raw SQL with proper type safety
    const [dbUser] = (await sql`
      SELECT id, clerk_id 
      FROM users 
      WHERE clerk_id = ${user.id} 
      LIMIT 1`
    ) as User[];
    
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Find book using raw SQL with proper type safety
    const [book] = (await sql`
      SELECT * 
      FROM books 
      WHERE slug = ${slug} 
        AND user_id = ${dbUser!.id} 
      LIMIT 1`
    ) as Book[];
    
    if (!book) return NextResponse.json({ error: 'Book not found' }, { status: 404 });

    const body = await request.json();
    const { title, content, parentChapterId, order, level } = body as {
      title?: string;
      content?: string;
      parentChapterId?: string | null;
      order?: number;
      level?: number;
    };

    if (
      !title &&
      content === undefined &&
      parentChapterId === undefined &&
      order === undefined &&
      level === undefined
    ) {
      return NextResponse.json({ error: 'At least one field must be updated' }, { status: 400 });
    }

    const updateData: {
      updatedAt: Date;
      title?: string;
      content?: string;
      isDraft?: boolean;
      order?: number;
      level?: number;
      parentChapterId?: string | null;
      wordCount?: number;
    } = {
      updatedAt: new Date(),
    };
    if (title) updateData.title = title;
    if (content !== undefined) {
      updateData.content = content;
      updateData.wordCount = content ? content.trim().split(/\s+/).length : 0;
    }
    if (parentChapterId !== undefined) updateData.parentChapterId = parentChapterId;
    if (order !== undefined) updateData.order = order;
    if (level !== undefined) updateData.level = level;

    // Update the chapter if it belongs to the book
    const [updatedChapter] = (await sql`
      UPDATE chapters 
      SET 
        title = ${title ?? null},
        content = ${content ?? null},
        parent_chapter_id = ${parentChapterId ?? null},
        "order" = ${order ?? null},
        level = ${level ?? null},
        updated_at = NOW()
      WHERE id = ${chapterId} 
        AND book_id = ${book!.id}
      RETURNING *`
    ) as Chapter[];

    if (!updatedChapter) {
      return NextResponse.json(
        { error: 'Chapter not found or access denied' }, 
        { status: 404 }
      );
    }

    return NextResponse.json(updatedChapter);
  } catch (error) {
    console.error('Error in PATCH /api/books/by-slug/[slug]/chapters/[chapterId]:', error);
    return NextResponse.json(
      { 
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
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
    // Ensure user is authenticated with Clerk
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' }, 
        { status: 401 }
      );
    }

    const { slug, chapterId } = context.params;
    if (!slug || !chapterId) {
      return NextResponse.json(
        { error: 'Book slug and chapter ID are required' }, 
        { status: 400 }
      );
    }

    // Find user using raw SQL with proper type safety
    const [dbUser] = (await sql`
      SELECT id, clerk_id 
      FROM users 
      WHERE clerk_id = ${user.id} 
      LIMIT 1`
    ) as User[];
    
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Find book using raw SQL with proper type safety
    const [book] = (await sql`
      SELECT * 
      FROM books 
      WHERE slug = ${slug} 
        AND user_id = ${dbUser!.id} 
      LIMIT 1`
    ) as Book[];
    
    if (!book) return NextResponse.json({ error: 'Book not found' }, { status: 404 });

    // Find chapter using raw SQL with proper type safety
    const [chapter] = (await sql`
      SELECT * 
      FROM chapters 
      WHERE id = ${chapterId} 
        AND book_id = ${book!.id} 
      LIMIT 1`
    ) as Chapter[];
    
    if (!chapter) return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });

    // Delete chapter using raw SQL with proper type safety
    const [deletedChapter] = (await sql`
      DELETE FROM chapters 
      WHERE id = ${chapterId} 
        AND book_id = ${book!.id} 
      RETURNING *`
    ) as Chapter[];

    if (!deletedChapter) {
      return NextResponse.json(
        { error: 'Chapter not found or access denied' }, 
        { status: 404 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error in DELETE /api/books/by-slug/[slug]/chapters/[chapterId]:', error);
    return NextResponse.json(
      { 
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}
