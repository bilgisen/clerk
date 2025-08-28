import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/drizzle';
import { books } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { generateImprintHTML } from '@/lib/generateChapterHTML';
import { withOidcOnly } from '@/lib/middleware/withOidcOnly';
import { logger } from '@/lib/logger';

// Configuration
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const runtime = 'nodejs';

// Types
type Book = typeof books.$inferSelect;

async function handler(
  request: NextRequest,
  { params }: { params: { slug: string } },
  oidcClaims: any
) {
  const requestStart = Date.now();
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'html';
  
  // Log OIDC context for audit
  logger.info('OIDC-authenticated imprint request', {
    repository: oidcClaims.repository,
    workflow: oidcClaims.workflow,
    run_id: oidcClaims.run_id,
    bookSlug: params.slug
  });

  if (format !== 'html' && format !== 'json') {
    logger.warn('Invalid format requested', { 
      format,
      slug: params.slug
    });
    
    return NextResponse.json(
      { 
        error: 'Invalid format',
        message: 'Format must be either html or json',
        code: 'INVALID_FORMAT'
      },
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get the book by slug with access control
    let book: Book | undefined;
    try {
      [book] = await db
        .select()
        .from(books)
        .where(
          and(
            eq(books.slug, params.slug),
            eq(books.userId, session.userId) // Ensure user owns the book
          )
        )
        .limit(1);

      if (!book) {
        logger.warn('Book not found or access denied', { 
          slug: params.slug, 
          userId: session.userId 
        });
        
        return new NextResponse(
          JSON.stringify({ 
            error: 'Book not found or access denied',
            code: 'BOOK_NOT_FOUND',
            message: `No book found with slug: ${params.slug}`
          }), 
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } catch (error) {
      logger.error('Error fetching book', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        slug: params.slug,
        userId: session.userId,
        sessionId: session.sessionId
      });
      
      return new NextResponse(
        JSON.stringify({ 
          error: 'Failed to fetch book',
          code: 'FETCH_BOOK_ERROR'
        }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    try {
      // Log successful access
      logger.info('Generating imprint', {
        bookId: book.id,
        format,
        userId: session.userId,
        sessionId: session.sessionId
      });

      // Generate the imprint content based on requested format
      if (format === 'html') {
        const imprintHTML = generateImprintHTML({
          title: book.title,
          author: book.author || 'Unknown Author',
          publisher: book.publisher || '',
          publisherWebsite: book.publisherWebsite || '',
          publishYear: book.publishYear || new Date().getFullYear(),
          isbn: book.isbn || '',
          language: book.language || 'tr',
          description: book.description || '',
          coverImageUrl: book.coverImageUrl || ''
        });

        logger.info('Successfully generated HTML imprint', {
          bookId: book.id,
          durationMs: Date.now() - requestStart,
          userId: session.userId
        });

        return new NextResponse(imprintHTML, {
          status: 200,
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
      } else {
        // JSON format
        return NextResponse.json({
          id: book.id,
          slug: book.slug,
          title: book.title,
          author: book.author,
          publisher: book.publisher,
          publisherWebsite: book.publisherWebsite,
          publishYear: book.publishYear,
          isbn: book.isbn,
          language: book.language,
          description: book.description,
          coverImageUrl: book.coverImageUrl,
          createdAt: book.createdAt,
          updatedAt: book.updatedAt,
        }, {
          headers: {
            'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('Error generating imprint', {
        error: errorMessage,
        stack: errorStack,
        bookId: book?.id,
        userId: session.userId,
        sessionId: session.sessionId,
        timestamp: new Date().toISOString()
      });
      
      return NextResponse.json(
        { 
          error: 'An error occurred while generating the imprint',
          code: 'IMPRINT_GENERATION_ERROR'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[IMPRINT_GET] Error:', error);
    return new NextResponse(
      JSON.stringify({ 
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), 
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}

// Export the handler wrapped with OIDC-only middleware
export const GET = withOidcOnly(handler);
