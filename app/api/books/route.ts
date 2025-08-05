import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { books } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * GET /api/books
 * Get all books for the authenticated user
 */
export async function GET() {
  try {
    // Get the current user session
    const session = await auth();
    const userId = session.userId;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    // Fetch all books for the current user
    const userBooks = await db.query.books.findMany({
      where: (books, { eq }) => eq(books.userId, userId),
      orderBy: (books, { desc }) => [desc(books.createdAt)],
    });

    return NextResponse.json(userBooks);
  } catch (error) {
    console.error('Error fetching books:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

/**
 * POST /api/books
 * Create a new book for the authenticated user
 */
export async function POST(request: Request) {
  try {
    // Get the current user session
    const session = await auth();
    const userId = session.userId;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { title, author, description, coverImageUrl } = body;

    if (!title || !author) {
      return NextResponse.json(
        { error: 'Title and author are required' },
        { status: 400 }
      );
    }

    // Create a new book
    const [newBook] = await db.insert(books).values({
      title,
      author,
      description: description || null,
      coverImageUrl: coverImageUrl || null,
      userId,
      slug: title.toLowerCase().replace(/\s+/g, '-'), // Simple slug generation
    }).returning();

    return NextResponse.json(newBook, { status: 201 });
  } catch (error) {
    console.error('Error creating book:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
