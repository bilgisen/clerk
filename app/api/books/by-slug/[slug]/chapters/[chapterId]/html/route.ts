import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/drizzle';
import { books, chapters } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateChapterHTML, generateCompleteDocumentHTML } from '@/lib/generateChapterHTML';
import { withAuth } from '@/lib/middleware/withAuth';
import type { AuthContext, ClerkAuth } from '@/lib/auth/types';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

type Chapter = typeof chapters.$inferSelect;
type Book = typeof books.$inferSelect;

// Match the BookWithChapters interface from generateChapterHTML
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
  context: RouteParams & { auth: AuthContext }
) {
  const { params, auth } = context;
  try {
    const { slug, chapterId } = params;
    const requestStart = Date.now();
    
    console.log('Authentication context:', {
      type: auth.type,
      userId: auth.userId,
      repository: auth.repository,
      ref: auth.ref,
      workflow: auth.workflow,
      actor: auth.actor,
      runId: auth.runId,
      permissions: auth.permissions
    });
    
    // For Clerk auth, verify the user owns the book
    if (auth.type === 'clerk' && auth.userId) {
      const clerkAuth = auth as unknown as ClerkAuth;
      const [book] = await db
        .select()
        .from(books)
        .where(eq(books.slug, slug));
        
      if (!book || book.userId !== auth.userId) {
        console.error(`Access denied: User ${auth.userId} does not have access to book ${slug}`);
        return new NextResponse(
          JSON.stringify({ 
            error: 'Access denied',
            message: 'You do not have permission to access this resource'
          }), 
          { 
            status: 403, 
            headers: { 
              'Content-Type': 'application/json',
              'WWW-Authenticate': 'Bearer error="insufficient_permissions"'
            } 
          }
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
    const statusCode = errorMessage.includes('authentication') ? 401 : 
                      errorMessage.includes('not found') ? 404 : 500;
                      
    console.error('[CHAPTER_HTML_GET] Error:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      params,
      timestamp: new Date().toISOString()
    });
    
    return new NextResponse(
      JSON.stringify({ 
        error: errorMessage,
        status: statusCode 
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

// Export the wrapped handler with authentication
export const GET = withAuth(handler as any); // Temporary type assertion to fix Next.js route handler typing
