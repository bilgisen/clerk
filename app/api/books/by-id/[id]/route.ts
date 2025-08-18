import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/books/by-id/[id]
 * Get a book by ID
 */
export async function GET(
  _request: Request,
  context: { params: { id: string } }
) {
  try {
    const session = await auth();
    const userId = session.userId;
    
    // Await params before destructuring
    const { id } = await context.params;

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { error: 'Book ID is required' },
        { status: 400 }
      );
    }

    // First, get the user's database ID from their Clerk ID
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get the book by ID and user ID
    const book = await db.query.books.findFirst({
      where: (books, { and, eq }) => and(
        eq(books.id, id),
        eq(books.userId, user.id)
      ),
      // Explicitly select the fields we want to return
      columns: {
        id: true,
        userId: true,
        title: true,
        slug: true,
        author: true,
        publisher: true,
        description: true,
        coverImageUrl: true,
        epubUrl: true,
        isPublished: true,
        isFeatured: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!book) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(book);
  } catch (error) {
    console.error('Error fetching book by ID:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
