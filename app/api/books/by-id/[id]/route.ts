import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/drizzle';
import { books, chapters } from '@/db/schema';
import { and, eq, type SQL } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/api-auth';
import type { InferSelectModel } from 'drizzle-orm';

// Helper function to build the where clause
const whereClause = (id: string, userId: string) => {
  return and(eq(books.id, id), eq(books.userId, userId));
};

/**
 * GET /api/books/by-id/[id]
 * Get a book by ID
 */
export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const { user: authUser, error } = await requireAuth(request);
    if (error) return error;

    if (!authUser?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = context.params;
    if (!id) {
      return NextResponse.json({ error: 'Book ID is required' }, { status: 400 });
    }

    const book = await db.query.books.findFirst({
      where: whereClause(id, authUser.id!),
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
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    return NextResponse.json(book);
  } catch (error) {
    console.error('Error getting book:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/books/by-id/[id]
 * Delete a book by ID
 */
export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const { user: authUser, error } = await requireAuth(request);
    if (error) return error;

    if (!authUser?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = context.params;
    if (!id) {
      return NextResponse.json({ error: 'Book ID is required' }, { status: 400 });
    }

    await db.transaction(async (tx) => {
      await tx.delete(chapters).where(eq(chapters.bookId, id));
      await tx.delete(books).where(
        whereClause(id, authUser.id!)
      );
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting book:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
