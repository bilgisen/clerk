import { type NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/db/drizzle';
import { books } from '@/db/schema';
import { generateImprintHTML, type BookImprintData } from '@/lib/generateChapterHTML';
import { withGithubOidcAuth, type HandlerWithAuth, type AuthContextUnion } from '@/middleware/old/auth';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

// Configure route behavior
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const runtime = 'nodejs';

// Types
type Book = typeof books.$inferSelect & {
  subtitle?: string | null;
  description?: string | null;
  publisherWebsite?: string | null;
  publishYear?: number | null;
  isbn?: string | null;
  language?: string | null;
  coverImageUrl?: string | null;
};

const handler: HandlerWithAuth = async (
  request: NextRequest,
  context: { 
    params?: Record<string, string>; 
    authContext: AuthContextUnion;
  } = { authContext: { type: 'unauthorized' } }
) => {
  const { params = {}, authContext } = context;
  const slug = params?.slug;
  
  // Validate slug parameter
  if (!slug) {
    const response = new NextResponse(
      JSON.stringify({ 
        error: 'Missing required parameter',
        message: 'Book slug is required',
        code: 'MISSING_PARAMETER'
      }),
      { 
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0',
          'X-Content-Type-Options': 'nosniff'
        } 
      }
    );
    return response;
  }
  
  // Ensure we have a valid GitHub OIDC context
  if (authContext.type !== 'github-oidc') {
    const response = new NextResponse(
      JSON.stringify({ 
        error: 'GitHub OIDC authentication required',
        code: 'AUTH_REQUIRED'
      }),
      { 
        status: 401, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Referrer-Policy': 'strict-origin-when-cross-origin'
        } 
      }
    );
    return response;
  }

  const { claims } = authContext;
  const requestStart = Date.now();
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'html';
  
  // Log OIDC context for audit
  logger.info('OIDC-authenticated imprint request', {
    repository: claims.repository_owner,
    workflow: claims.workflow,
    run_id: claims.run_id,
    bookSlug: slug,
    format,
    userId: claims.sub
  });

  // Validate format
  if (format !== 'html' && format !== 'json') {
    logger.warn('Invalid format requested', { format, slug });
    const response = new NextResponse(
      JSON.stringify({ 
        error: 'Invalid format',
        message: 'Format must be either html or json',
        code: 'INVALID_FORMAT'
      }),
      { 
        status: 400, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY'
        } 
      }
    );
    return response;
  }

  try {
    // Find the book by slug
    const book = await db.query.books.findFirst({
      where: eq(books.slug, slug),
      columns: {
        id: true,
        title: true,
        author: true,
        publisher: true,
        publisherWebsite: true,
        publishYear: true,
        isbn: true,
        language: true,
        description: true,
        coverImageUrl: true,
        subtitle: true,
        slug: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!book) {
      logger.warn('Book not found', { slug });
      const response = new NextResponse(
        JSON.stringify({ 
          error: 'Not Found',
          message: `No book found with slug: ${slug}`,
          code: 'BOOK_NOT_FOUND'
        }),
        { 
          status: 404,
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, max-age=0',
            'X-Content-Type-Options': 'nosniff'
          } 
        }
      );
      return response;
    }

    // Log successful access
    logger.info('Generating imprint', {
      bookId: book.id,
      format,
      userId: claims.sub
    });

    // Prepare book data for imprint
    const imprintData: BookImprintData = {
      title: book.title,
      author: book.author || 'Unknown Author',
      publisher: book.publisher || undefined,
      publisherWebsite: book.publisherWebsite || undefined,
      publishYear: book.publishYear || undefined,
      isbn: book.isbn || undefined,
      language: book.language || 'tr',
      description: book.description || undefined,
      coverImageUrl: book.coverImageUrl || undefined
    };

    // Generate the imprint content based on requested format
    if (format === 'html') {
      const imprintHTML = generateImprintHTML(imprintData);
      const duration = Date.now() - requestStart;

      logger.info('Successfully generated HTML imprint', {
        bookId: book.id,
        durationMs: duration,
        userId: claims.sub
      });

      const response = new NextResponse(imprintHTML, {
        status: 200,
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
      return response;
    } else {
      // Return JSON format
      const responseData = {
        ...imprintData,
        _metadata: {
          generatedAt: new Date().toISOString(),
          format: 'json',
          version: '1.0'
        },
        _links: {
          self: `${process.env.NEXT_PUBLIC_APP_URL}/api/books/by-slug/${book.slug}/imprint?format=json`,
          html: `${process.env.NEXT_PUBLIC_APP_URL}/api/books/by-slug/${book.slug}/imprint?format=html`,
          book: `${process.env.NEXT_PUBLIC_APP_URL}/api/books/by-slug/${book.slug}`,
          cover: book.coverImageUrl ? {
            href: book.coverImageUrl,
            type: 'image/*'
          } : undefined
        }
      };

      const duration = Date.now() - requestStart;
      logger.info('Successfully generated JSON imprint', {
        bookId: book.id,
        durationMs: duration,
        userId: claims.sub
      });

      const response = new NextResponse(JSON.stringify(responseData), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'X-Response-Time': `${duration}ms`
        }
      });
      return response;
    }
  } catch (error) {
    const errorId = `err_${Math.random().toString(36).substring(2, 11)}`;
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Error generating imprint', {
      error: errorMessage,
      stack: errorStack,
      errorId,
      bookSlug: slug,
      userId: claims?.sub,
      format
    });

    const errorResponse = {
      error: 'Internal Server Error',
      message: 'An error occurred while generating the imprint',
      errorId,
      code: 'INTERNAL_SERVER_ERROR',
      _links: {
        support: 'https://bookshall.com/support',
        documentation: 'https://docs.bookshall.com/api/errors'
      }
    };

    const response = new NextResponse(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-Error-ID': errorId,
        'Retry-After': '60',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff'
      }
    });
    return response;
  }
};

// Export the handler wrapped with GitHub OIDC auth middleware
export const GET = withGithubOidcAuth(handler);
