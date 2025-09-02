// app/api/books/by-slug/[slug]/chapters/[chapterId]/html/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/drizzle';
import { books, chapters } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateCompleteDocumentHTML } from '@/lib/generateChapterHTML';
import type { AuthContextUnion, SessionAuthContext } from '@/types/auth.types';
import { logger } from '@/lib/logger';

// Configuration
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const runtime = 'nodejs';

// Types
type Chapter = typeof chapters.$inferSelect;

// Define missing types
type HandlerWithAuth<T extends Record<string, string> = Record<string, string>> = (
  request: NextRequest,
  context: { 
    params?: T; 
    authContext: AuthContextUnion;
  }
) => Promise<NextResponse>;

// Helper function to check if auth context is session type
const isSessionAuthContext = (authContext: AuthContextUnion): authContext is SessionAuthContext => {
  return authContext.type === 'session';
};

const handleRequest: HandlerWithAuth<{ slug: string; chapterId: string }> = async (
  request: NextRequest,
  context: { 
    params?: { slug: string; chapterId: string }; 
    authContext: AuthContextUnion;
  }
): Promise<NextResponse> => {
  // Ensure we have a valid session
  if (!isSessionAuthContext(context.authContext)) {
    return new NextResponse(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  const authContext = context.authContext;
  const { slug, chapterId } = context.params || {};
  
  if (!slug || !chapterId) {
    return new NextResponse(
      JSON.stringify({ error: 'Missing required parameters' }), 
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const requestStart = Date.now();
  const userId = authContext.user?.id;
  
  try {
    logger.info('Chapter HTML request', {
      bookSlug: slug,
      chapterId,
      userId: authContext.user?.id
    });

    // Get the book with the requested chapter
    const bookWithChapters = await db.query.books.findFirst({
      where: and(
        eq(books.slug, slug),
        // Add any additional conditions here if needed
      ),
      with: {
        chapters: {
          where: eq(chapters.bookId, books.id),
          orderBy: [chapters.order]
        }
      }
    });

    if (!bookWithChapters) {
      logger.warn('Book not found', { slug });
      return new NextResponse(
        JSON.stringify({ error: 'Book not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const requestedChapter = bookWithChapters.chapters.find(c => c.id === chapterId);
    if (!requestedChapter) {
      logger.warn('Chapter not found', { bookId: bookWithChapters.id, chapterId });
      return new NextResponse(
        JSON.stringify({ error: 'Chapter not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate the HTML content
    const title = requestedChapter.title || 'Untitled Chapter';
    const content = typeof requestedChapter.content === 'string' 
      ? requestedChapter.content 
      : '';
    const metadata = {
      book: bookWithChapters.title || 'Untitled Book',
      chapter_id: `ch-${requestedChapter.id}`,
      order: requestedChapter.order,
      level: requestedChapter.level,
      title_tag: `h${Math.min(requestedChapter.level, 6)}`,
      title: requestedChapter.title || 'Untitled Chapter',
      parent_chapter: requestedChapter.parentChapterId || undefined
    };
    
    const completeHTML = generateCompleteDocumentHTML(title, content, metadata);

    // Log successful response
    logger.info('Successfully generated chapter HTML', {
      bookId: bookWithChapters.id,
      chapterId: requestedChapter.id,
      durationMs: Date.now() - requestStart,
      userId,
      sessionId: (authContext as SessionAuthContext).sessionId
    });

    return new NextResponse(completeHTML, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https:;"
      }
    });

  } catch (error) {
    logger.error('Error generating chapter HTML', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      bookSlug: slug,
      chapterId,
      userId,
      durationMs: Date.now() - requestStart
    });

    return new NextResponse(
      JSON.stringify({ 
        error: 'Internal server error',
        requestId: request.headers.get('x-request-id') || crypto.randomUUID()
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

// Mock withSessionAuth middleware (replace with your actual implementation)
const withSessionAuth = <T extends Record<string, string>>(
  handler: HandlerWithAuth<T>
): HandlerWithAuth<T> => {
  // This is a placeholder - replace with your actual auth middleware
  return handler;
};

// Export the wrapped handler
export const GET = withSessionAuth(handleRequest);