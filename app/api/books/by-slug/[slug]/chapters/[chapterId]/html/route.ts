import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/db/drizzle';
import { books, chapters } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateChapterHTML, generateCompleteDocumentHTML } from '@/lib/generateChapterHTML';
import { verifyRequest } from '@/lib/verify-jwt';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

type Chapter = typeof chapters.$inferSelect;
type Book = typeof books.$inferSelect;

// Match the BookWithChapters interface from generateChapterHTML
interface BookWithChapters extends Book {
  chapters?: Chapter[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string; chapterId: string } }
) {
  try {
    const { slug, chapterId } = params;
    const requestStart = Date.now();
    
    // Verify authentication
    const auth = await verifyRequest(request);
    
    console.log('Authentication successful:', {
      type: auth.type,
      userId: auth.userId,
      repository: auth.repository,
      ref: auth.ref,
      workflow: auth.workflow,
      actor: auth.actor,
      runId: auth.runId
    });
    
    // For Clerk auth, verify the user owns the book
    if (auth.type === 'clerk' && auth.userId) {
      const [book] = await db
        .select()
        .from(books)
        .where(eq(books.slug, slug));
        
      if (!book || book.userId !== auth.userId) {
        console.error(`Access denied: User ${auth.userId} does not have access to book ${slug}`);
        return new NextResponse(
          JSON.stringify({ error: 'Access denied' }), 
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    
    console.log(`[${new Date().toISOString()}] Request for book: ${slug}, chapter: ${chapterId}`);

    // Get the book
    const [book] = await db
      .select()
      .from(books)
      .where(eq(books.slug, slug))
      .limit(1);

    if (!book) {
      console.error(`Book not found: ${slug}`);
      return new NextResponse('Book not found', { status: 404 });
    }

    // Get all chapters for the book in a single query
    const allChapters = await db
      .select()
      .from(chapters)
      .where(eq(chapters.bookId, book.id))
      .orderBy(chapters.order, chapters.createdAt);

    // Find the requested chapter
    const chapter = allChapters.find(c => c.id === chapterId);
    if (!chapter) {
      console.error('Chapter not found:', { chapterId, bookId: book.id });
      return new NextResponse('Chapter not found', { status: 404 });
    }

    // Get direct child chapters
    const childChapters = allChapters.filter(c => c.parentChapterId === chapter.id);
    
    // Prepare book data for the template
    const bookWithChapters: BookWithChapters = {
      ...book,
      chapters: allChapters,
    };

    // Generate the HTML content
    const chapterHTML = generateChapterHTML(chapter, childChapters, bookWithChapters);
    const completeHTML = generateCompleteDocumentHTML(
      `${book.title || 'Untitled Book'} - ${chapter.title || 'Untitled Chapter'}`,
      chapterHTML
    );

    // Log successful response
    console.log(`Successfully generated HTML for chapter ${chapterId} in book ${book.id} [${Date.now() - requestStart}ms]`);

    return new NextResponse(completeHTML, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CHAPTER_HTML_GET] Error:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      params,
    });
    return new NextResponse('Error generating chapter HTML', { 
      status: errorMessage.includes('authentication') ? 401 : 500,
      headers: {
        'Cache-Control': 'no-store, no-cache',
        'Content-Type': 'application/json',
      },
    });
  }
}
