import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/drizzle';
import { books, chapters } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { generateChapterHTML, generateCompleteDocumentHTML } from '@/lib/generateChapterHTML';
import { withGithubOidcAuth, type AuthContextUnion, type HandlerWithAuth } from '@/middleware/auth';
import { logger } from '@/lib/logger';

type GitHubOidcContext = Extract<AuthContextUnion, { type: 'github-oidc' }>;

// Configuration
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const runtime = 'nodejs';

// Types
type Chapter = typeof chapters.$inferSelect;
type Book = typeof books.$inferSelect;

interface BookWithChapters extends Omit<Book, 'chapters'> {
  chapters: Chapter[];
}

const handleRequest: HandlerWithAuth = async (
  request: NextRequest,
  context: { params?: Record<string, string>; authContext: AuthContextUnion } = { authContext: { type: 'unauthorized' } }
): Promise<NextResponse> => {
  // Ensure we have a valid GitHub OIDC context
  if (context.authContext.type !== 'github-oidc') {
    return new NextResponse(
      JSON.stringify({ error: 'GitHub OIDC authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  const authContext = context.authContext;
  const slug = context.params?.slug;
  const chapterId = context.params?.chapterId;
  
  if (!slug || !chapterId) {
    return new NextResponse(
      JSON.stringify({ error: 'Missing required parameters' }), 
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const requestStart = Date.now();
  const userId = authContext.userId;
  
  try {
    logger.info('OIDC-authenticated chapter HTML request', {
      repository: authContext.repository,
      workflow: authContext.workflow,
      runId: authContext.runId,
      bookSlug: slug,
      chapterId
    });

    // Get the book with the requested chapter
    const bookWithChapters = await db.query.books.findFirst({
      where: and(
        eq(books.slug, slug),
        eq(books.userId, userId)
      ),
      with: {
        chapters: {
          where: eq(chapters.id, chapterId)
        }
      }
    });

    if (!bookWithChapters) {
      logger.warn('Book not found or access denied', { slug, userId });
      return new NextResponse(
        JSON.stringify({ error: 'Book not found or access denied' }), 
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get the requested chapter
    const chapter = bookWithChapters.chapters[0];
    if (!chapter) {
      logger.warn('Chapter not found', { chapterId, bookId: bookWithChapters.id, userId });
      return new NextResponse(
        JSON.stringify({ error: 'Chapter not found or access denied' }), 
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get all chapters for the book
    const allChapters = await db.query.chapters.findMany({
      where: eq(chapters.bookId, bookWithChapters.id),
      orderBy: (chapters, { asc }) => [asc(chapters.order)]
    });

    // Find the requested chapter with case-insensitive comparison
    const requestedChapter = allChapters.find(c => c.id.toLowerCase() === chapterId.toLowerCase());
    if (!requestedChapter) {
      logger.warn('Chapter not found in full chapter list', { 
        chapterId, 
        bookId: bookWithChapters.id,
        userId,
        availableChapters: allChapters.map(c => ({ id: c.id, title: c.title }))
      });
      
      return new NextResponse(
        JSON.stringify({ error: 'Chapter not found' }), 
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if the book is published or user has access
    if (!bookWithChapters.publishedAt && bookWithChapters.userId !== userId) {
      logger.warn('Book not published or access denied', { slug, userId });
      return new NextResponse(
        JSON.stringify({ error: 'Book not published or access denied' }), 
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get direct child chapters
    const childChapters = allChapters.filter(c => 
      c.parentChapterId && c.parentChapterId.toLowerCase() === requestedChapter.id.toLowerCase()
    );

    // Generate the HTML content
    const chapterHTML = generateChapterHTML(requestedChapter, childChapters, bookWithChapters);
    const completeHTML = generateCompleteDocumentHTML(
      `${bookWithChapters.title || 'Untitled Book'} - ${requestedChapter.title || 'Untitled Chapter'}`,
      chapterHTML,
      {
        book: bookWithChapters.title || 'Untitled Book',
        chapter_id: requestedChapter.id,
        order: requestedChapter.order || 0,
        level: requestedChapter.level || 1,
        title_tag: `h${Math.min((requestedChapter.level || 1) + 1, 6)}`,
        title: requestedChapter.title || 'Untitled Chapter',
        ...(requestedChapter.parentChapterId ? { parent_chapter: requestedChapter.parentChapterId } : {})
      }
    );

    // Log successful response
    logger.info('Generated chapter HTML', {
      bookId: bookWithChapters.id,
      chapterId: requestedChapter.id,
      durationMs: Date.now() - requestStart,
      userId,
      sessionId: authContext.runId
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const statusCode = errorMessage.includes('authentication') ? 401 : 
                      errorMessage.includes('not found') ? 404 : 500;
                      
    logger.error('Unexpected error in chapter HTML handler', {
      error: errorMessage,
      stack: errorStack,
      bookSlug: slug,
      chapterId,
      userId,
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

// Export the wrapped handler
// Wrap the handler with GitHub OIDC authentication
export const GET = withGithubOidcAuth(handleRequest);
