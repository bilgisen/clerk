import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { chapters } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { slug } = params;
    if (!slug) {
      return NextResponse.json(
        { error: 'Book slug is required' },
        { status: 400 }
      );
    }

    // First, get the book ID using the slug
    const book = await db.query.books.findFirst({
      where: (books, { eq }) => eq(books.slug, slug),
      columns: {
        id: true
      }
    });

    if (!book) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      );
    }

    // Fetch all chapters for the book
    const bookChapters = await db.query.chapters.findMany({
      where: and(
        eq(chapters.bookId, book.id),
        eq(chapters.userId, userId)
      ),
      orderBy: (chapters, { asc }) => [asc(chapters.order)]
    });

    return NextResponse.json(bookChapters);
  } catch (error) {
    console.error('Error fetching chapters:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { slug } = params;
    if (!slug) {
      return NextResponse.json(
        { error: 'Book slug is required' },
        { status: 400 }
      );
    }

    // First, get the book ID using the slug
    const book = await db.query.books.findFirst({
      where: (books, { eq }) => eq(books.slug, slug),
      columns: {
        id: true
      }
    });

    if (!book) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      );
    }

    const { title, content, order, parentId } = await request.json();

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // Create the new chapter
    const [newChapter] = await db.insert(chapters).values({
      title,
      content: content || '',
      order: order || 0,
      bookId: book.id,
      userId,
      parentId: parentId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return NextResponse.json(newChapter, { status: 201 });
  } catch (error) {
    console.error('Error creating chapter:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
