import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { books } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    const userId = session.userId;
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const bookId = params.id;
    if (!bookId) {
      return NextResponse.json(
        { error: 'Book ID is required' },
        { status: 400 }
      );
    }

    // Verify the book exists and belongs to the user
    const book = await db.query.books.findFirst({
      where: and(
        eq(books.id, bookId),
        eq(books.userId, userId)
      ),
    });

    if (!book) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      );
    }

    // Update book status to GENERATING
    await db.update(books)
      .set({ 
        publishStatus: 'GENERATING',
        updatedAt: new Date()
      })
      .where(eq(books.id, bookId));

    try {
      // Generate EPUB (synchronous for now)
      // TODO: Replace this with your actual EPUB generation logic
      const epubUrl = await generateEPUB(bookId);
      
      // Update book with the generated EPUB URL
      await db.update(books)
        .set({ 
          publishStatus: 'PUBLISHED',
          epubUrl,
          isPublished: true,
          publishedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(books.id, bookId));

      return NextResponse.json({ 
        success: true, 
        url: epubUrl 
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update book with error status
      await db.update(books)
        .set({ 
          publishStatus: 'FAILED',
          publishError: errorMessage,
          updatedAt: new Date()
        })
        .where(eq(books.id, bookId));

      logger.error('Failed to publish book', { 
        bookId, 
        userId, 
        error: errorMessage 
      });

      return NextResponse.json(
        { 
          error: 'Failed to publish book',
          details: errorMessage 
        },
        { status: 500 }
      );
    }

  } catch (error) {
    logger.error('Error in publish endpoint', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// TODO: Replace with your actual EPUB generation logic
async function generateEPUB(bookId: string): Promise<string> {
  // Simulate EPUB generation
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // In a real implementation, this would generate the EPUB file
  // and return the URL where it's stored (e.g., S3, R2, etc.)
  return `https://example.com/books/${bookId}/book.epub`;
}
