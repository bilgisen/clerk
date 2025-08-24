import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/drizzle';
import { books, chapters } from '@/db/schema';

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { slug } = params;
    const { chapterId, content } = await request.json();

    if (!chapterId || !content) {
      return new NextResponse('Missing required fields', { status: 400 });
    }

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

    // Update the chapter with autosave data
    const [updatedChapter] = await db
      .update(chapters)
      .set({
        content,
        updatedAt: new Date(),
      })
      .where(eq(chapters.id, chapterId))
      .returning();

    return NextResponse.json({
      success: true,
      chapter: updatedChapter
    });
  } catch (error) {
    console.error('[AUTOSAVE_CHAPTER_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
