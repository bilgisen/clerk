import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/drizzle';
import { books, chapters } from '@/db/schema';

export async function GET(
  request: Request,
  { params }: { params: { slug: string; chapterId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { slug, chapterId } = params;

    // Verify the book exists and belongs to the user
    const book = await db.query.books.findFirst({
      where: and(
        eq(books.slug, slug),
        eq(books.userId, userId)
      ),
    });

    if (!book) {
      return new NextResponse('Book not found', { status: 404 });
    }

    // Get the chapter
    const chapter = await db.query.chapters.findFirst({
      where: and(
        eq(chapters.id, chapterId),
        eq(chapters.bookId, book.id)
      ),
    });

    if (!chapter) {
      return new NextResponse('Chapter not found', { status: 404 });
    }

    return NextResponse.json(chapter);
  } catch (error) {
    console.error('[CHAPTER_GET_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { slug: string; chapterId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { slug, chapterId } = params;
    const body = await request.json();

    // Verify the book exists and belongs to the user
    const book = await db.query.books.findFirst({
      where: and(
        eq(books.slug, slug),
        eq(books.userId, userId)
      ),
    });

    if (!book) {
      return new NextResponse('Book not found', { status: 404 });
    }

    // Verify the chapter exists and belongs to the book
    const existingChapter = await db.query.chapters.findFirst({
      where: and(
        eq(chapters.id, chapterId),
        eq(chapters.bookId, book.id)
      ),
    });

    if (!existingChapter) {
      return new NextResponse('Chapter not found', { status: 404 });
    }

    // Update the chapter
    const [updatedChapter] = await db
      .update(chapters)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(chapters.id, chapterId))
      .returning();

    return NextResponse.json(updatedChapter);
  } catch (error) {
    console.error('[CHAPTER_UPDATE_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
