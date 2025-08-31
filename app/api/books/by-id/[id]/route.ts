import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, books, chapters, media } from '@/db/schema';
import { eq } from 'drizzle-orm';
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
    const { user, error } = await requireAuth();
    if (error) return error;
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
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
      where: ((books: unknown, { and, eq }: DrizzleOperators) => and(
        eq((books as { id: string }).id, id),
        eq((books as { userId: string }).userId, user.id)
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
    console.error('Error fetching book by ID:', error);
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
    const session = await auth();
    const userId = session.userId;
    const { id } = context.params;

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

    // Check if book exists and belongs to user
    const book = await db.query.books.findFirst({
      where: ((books: unknown, { and, eq }: DrizzleOperators) => and(
        eq((books as { id: string }).id, id),
        eq((books as { userId: string }).userId, user.id)
      )) as DrizzleWhereFn,
      columns: {
        id: true
      },
    });

    if (!book) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      );
    }

    const creditService = new CreditService();
    
    // Delete the book and all related data in a transaction
    await db.transaction(async (tx: typeof db) => {
      // Delete all media associated with the book
      await tx.delete(media).where(eq(media.bookId, id));
      
      // Delete all chapters associated with the book
      await tx.delete(chapters).where(eq(chapters.bookId, id));
      
      // Refund 300 credits to the user
      await creditService.addCredits({
        userId: user.id,
        amount: 300,
        reason: 'book_deletion_refund',
        metadata: {
          bookId: id,
          ref: `book:${id}`,
          refundAmount: 300,
          type: 'refund',
          title: 'Book Deletion Refund'
        }
      });
      
      // Finally, delete the book
      await tx.delete(books).where(eq(books.id, id));
    });

    return NextResponse.json(
      { success: true, message: 'Book deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting book:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
