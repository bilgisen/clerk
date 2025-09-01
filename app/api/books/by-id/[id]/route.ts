import { NextResponse } from 'next/server';
import { db } from '@/db';
import { books, chapters } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/api-auth';
import { CreditService } from '@/lib/services/credits/credit-service';

// Type for Drizzle's where clause operators
interface DrizzleOperators {
  and: (a: unknown, b: unknown) => unknown;
  eq: (a: unknown, b: unknown) => unknown;
}

// Type for Drizzle's query builder
type DrizzleWhereFn = (
  table: unknown,
  operators: DrizzleOperators
) => unknown;

/**
 * GET /api/books/by-id/[id]
 * Get a book by ID
 */
export async function GET(
  _request: Request,
  context: { params: { id: string } }
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
    
    const { id } = context.params;

    if (!authUser.id) {
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

    // Get the book by ID and user ID
    const book = await db.query.books.findFirst({
      where: ((books: unknown, { and, eq }: DrizzleOperators) => and(
        eq((books as { id: string }).id, id),
        eq((books as { userId: string }).userId, authUser.id)
      )) as DrizzleWhereFn,
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
    console.error('Error getting book:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/books/by-id/[id]
 * Delete a book by ID
 */
export async function DELETE(
  request: Request,
  context: { params: { id: string } }
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
    
    const { id } = context.params;

    if (!authUser.id) {
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

    // Start a transaction
    await db.transaction(async (tx: typeof db) => {
      // First, delete all chapters associated with the book
      await tx.delete(chapters).where(eq(chapters.bookId, id));
      
      // Then delete the book
      await tx.delete(books)
        .where(
          and(
            eq(books.id, id),
            eq(books.userId, authUser.id)
          )
        );
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting book:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
