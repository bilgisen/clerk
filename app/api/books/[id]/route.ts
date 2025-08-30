import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db/server';
import { books, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// GET /api/books/[id]
// Get a single book by ID
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const book = await db.query.books.findFirst({
      where: and(
        eq(books.id, params.id),
        eq(books.userId, userId)
      ),
      with: {
        user: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          },
        },
      },
    });

    if (!book) {
      return new NextResponse('Book not found', { status: 404 });
    }

    return NextResponse.json(book);
  } catch (error) {
    console.error('[BOOK_GET]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}

// PUT /api/books/[id]
// Update a book
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    
    // Verify the book exists and belongs to the user
    const existingBook = await db.query.books.findFirst({
      where: and(
        eq(books.id, params.id),
        eq(books.userId, userId)
      ),
    });

    if (!existingBook) {
      return new NextResponse('Book not found', { status: 404 });
    }

    // Update the book
    const [updatedBook] = await db
      .update(books)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(books.id, params.id),
          eq(books.userId, userId)
        )
      )
      .returning();

    return NextResponse.json(updatedBook);
  } catch (error) {
    console.error('[BOOK_UPDATE]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}

// DELETE /api/books/[id]
// Delete a book
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Verify the book exists and belongs to the user
    const existingBook = await db.query.books.findFirst({
      where: and(
        eq(books.id, params.id),
        eq(books.userId, userId)
      ),
    });

    if (!existingBook) {
      return new NextResponse('Book not found', { status: 404 });
    }

    // Delete the book
    await db
      .delete(books)
      .where(
        and(
          eq(books.id, params.id),
          eq(books.userId, userId)
        )
      );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[BOOK_DELETE]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}
