import { NextResponse } from 'next/server';
import { db } from '@/db/drizzle';
import { books, chapters } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    // Test books table
    const allBooks = await db.query.books.findMany({
      limit: 5,
      columns: {
        id: true,
        title: true,
        slug: true,
        userId: true
      }
    });

    // Test chapters table
    const allChapters = await db.query.chapters.findMany({
      limit: 5,
      columns: {
        id: true,
        title: true,
        bookId: true,
        parentChapterId: true,
        level: true,
        order: true
      },
      orderBy: (chapters, { asc }) => [asc(chapters.createdAt)]
    });

    // Test a specific book by slug
    const testSlug = 'hobbitin-donusu';
    const testBook = await db.query.books.findFirst({
      where: eq(books.slug, testSlug),
      with: {
        chapters: {
          limit: 5,
          orderBy: (chapters, { asc }) => [asc(chapters.order)]
        }
      }
    });

    return NextResponse.json({
      success: true,
      books: allBooks,
      chapters: allChapters,
      testBook: {
        ...testBook,
        chapters: testBook?.chapters || []
      }
    });
  } catch (error) {
    console.error('Database test error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Database query failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
