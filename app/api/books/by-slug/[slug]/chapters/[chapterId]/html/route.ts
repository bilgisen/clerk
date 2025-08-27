import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/drizzle';
import { books, chapters } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { generateChapterHTML, generateCompleteDocumentHTML } from '@/lib/generateChapterHTML';
import { withCombinedToken } from '@/lib/middleware/withCombinedToken';
import { logger } from '@/lib/logger';
import { getSession } from '@/lib/redis/session';

// Configuration
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const runtime = 'nodejs';

// Types
type Chapter = typeof chapters.$inferSelect;
type Book = typeof books.$inferSelect;

interface BookWithChapters extends Book {
  chapters?: Chapter[];
}

interface RouteParams {
  params: {
    slug: string;
    chapterId: string;
  };
}

async function handler(
  request: NextRequest,
  { params }: { params: { slug: string; chapterId: string } },
  session: { sessionId: string; userId: string }
) {
  try {
    const { slug, chapterId } = params;
    const requestStart = Date.now();
    
    console.log(`[${new Date().toISOString()}] Request for book: ${slug}, chapter: ${chapterId}`);

    // Get the current session for additional context
    const currentSession = await getSession(session.sessionId);
    if (!currentSession) {
      logger.warn('Session not found', { sessionId: session.sessionId });
      return new NextResponse(
        JSON.stringify({ error: 'Session expired or invalid' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get the book with proper error handling and access control
    let book: BookWithChapters | undefined;
    try {
      const result = await db
        .select()
        .from(books)
        .where(
          and(
            eq(books.slug, slug),
            eq(books.userId, session.userId) // Ensure user owns the book
          )
        )
        .limit(1);

      book = result[0] as BookWithChapters | undefined;

      if (!book) {
        logger.warn('Book not found or access denied', { 
          slug, 
          userId: session.userId,
          sessionId: session.sessionId 
        });
        return new NextResponse(
          JSON.stringify({ error: 'Book not found or access denied' }), 
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } catch (error) {
      logger.error('Error fetching book', { 
        error, 
        slug, 
        userId: session.userId,
        sessionId: session.sessionId 
      });
      return new NextResponse(
        JSON.stringify({ error: 'Internal server error' }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get all chapters for the book with access control
    let allChapters: Chapter[] = [];
    try {
      allChapters = await db
        .select()
        .from(chapters)
        .where(
          and(
            eq(chapters.bookId, book.id),
            eq(chapters.userId, session.userId), // Ensure user owns the chapters
            eq(chapters.isDraft, false) // Only include published chapters
          )
        )
        .orderBy(chapters.order);
    } catch (error) {
      console.error('Error fetching chapters:', error);
      return new NextResponse(
        JSON.stringify({ error: 'Error fetching chapters' }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Find the requested chapter with case-insensitive comparison
    const chapter = allChapters.find(c => c.id.toLowerCase() === chapterId.toLowerCase());
    
    if (!chapter) {
      logger.warn('Chapter not found or access denied', { 
        chapterId, 
        bookId: book.id,
        userId: session.userId,
        availableChapters: allChapters.map(c => ({ id: c.id, title: c.title }))
      });
      
      return new NextResponse(
        JSON.stringify({ 
          error: 'Chapter not found or access denied',
          chapterId,
        }), 
        { 
          status: 404, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get direct child chapters with case-insensitive comparison
    const childChapters = allChapters.filter(c => 
      c.parentChapterId && c.parentChapterId.toLowerCase() === chapter.id.toLowerCase()
    );
    
    // Prepare book data for the template
    const bookWithChapters: BookWithChapters = {
      ...book,
      chapters: allChapters,
    };
    
    logger.debug('Prepared chapter data', {
      bookId: book.id,
      chapterId: chapter.id,
      childChapterCount: childChapters.length,
      totalChapters: allChapters.length,
      userId: session.userId
    });

    try {
      // Generate the HTML content
      const chapterHTML = generateChapterHTML(chapter, childChapters, bookWithChapters);
      const completeHTML = generateCompleteDocumentHTML(
        `${book.title || 'Untitled Book'} - ${chapter.title || 'Untitled Chapter'}`,
        chapterHTML
      );

      // Log successful response
      logger.info('Generated chapter HTML', {
        bookId: book.id,
        chapterId: chapter.id,
        durationMs: Date.now() - requestStart,
        userId: session.userId,
        sessionId: session.sessionId
      });

      return new NextResponse(completeHTML, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        },
      });
    } catch (error) {
      logger.error('Error generating HTML', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        bookId: book?.id,
        chapterId,
        userId: session.userId,
        sessionId: session.sessionId
      });
      
      return new NextResponse(
        JSON.stringify({ 
          error: 'Failed to generate HTML',
          code: 'HTML_GENERATION_ERROR'
        }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const statusCode = errorMessage.includes('authentication') ? 401 : 
                      errorMessage.includes('not found') ? 404 : 500;
                      
    logger.error('Unexpected error in chapter HTML handler', {
      error: errorMessage,
      stack: errorStack,
      bookSlug: params?.slug,
      chapterId: params?.chapterId,
      userId: session?.userId,
      sessionId: session?.sessionId,
      timestamp: new Date().toISOString()
    });
    
    return new NextResponse(
      JSON.stringify({ 
        error: 'An unexpected error occurred',
        code: 'INTERNAL_SERVER_ERROR'
      }), { 
        status: statusCode,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
        },
      }
    );
  }
}

// Export the handler wrapped with combined token middleware
export const GET = withCombinedToken(handler, {
  requireSession: true,
  requireUser: true,
  requireBookAccess: true
});
