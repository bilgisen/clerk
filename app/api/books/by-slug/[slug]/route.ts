import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
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

/**
 * GET /api/books/by-slug/[slug]
 * Get a single book by slug for the authenticated user
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    const userId = session.userId;

    const { slug } = await context.params;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!slug) {
      return NextResponse.json({ error: 'Book slug is required' }, { status: 400 });
    }

    // Find user using raw SQL with proper type safety
    const [user] = (await sql`
      SELECT id, clerk_id 
      FROM users 
      WHERE clerk_id = ${userId} 
      LIMIT 1`
    ) as User[];

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Find book using raw SQL with proper type safety
    const [book] = (await sql`
      SELECT * 
      FROM books 
      WHERE slug = ${slug} 
        AND user_id = ${user.id} 
      LIMIT 1`
    ) as Book[];

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    return NextResponse.json(book);
  } catch (error) {
    console.error('Error fetching book by slug:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/books/by-slug/[slug]
 * Delete a book by slug
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const session = await auth();
    const userId = session.userId;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!slug) {
      return NextResponse.json({ error: 'Book slug is required' }, { status: 400 });
    }

    // Find user using raw SQL with proper type safety
    const [user] = (await sql`
      SELECT id, clerk_id 
      FROM users 
      WHERE clerk_id = ${userId} 
      LIMIT 1`
    ) as User[];

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Find book using raw SQL with proper type safety
    const [book] = (await sql`
      SELECT * 
      FROM books 
      WHERE slug = ${slug} 
        AND user_id = ${user.id} 
      LIMIT 1`
    ) as Book[];

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // Delete the book using raw SQL
    await sql`
      DELETE FROM books 
      WHERE id = ${book.id} 
        AND user_id = ${user.id}`;

    return NextResponse.json(
      { success: true, message: 'Book deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting book:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
