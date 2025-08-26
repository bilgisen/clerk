import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/drizzle';
import { books } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateImprintHTML } from '@/lib/generateChapterHTML';

// Configuration
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const runtime = 'nodejs';

// Types
type Book = typeof books.$inferSelect;

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const requestStart = Date.now();
  
  // Authentication is handled by middleware
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'html';

  if (format !== 'html' && format !== 'json') {
    return NextResponse.json(
      { 
        error: 'Invalid format',
        message: 'Format must be either html or json',
        status: 400
      },
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get the book by slug with proper error handling
    let book: Book | undefined;
    try {
      [book] = await db
        .select()
        .from(books)
        .where(eq(books.slug, params.slug))
        .limit(1);

      if (!book) {
        console.error(`Book not found: ${params.slug}`);
        return new NextResponse(
          JSON.stringify({ 
            error: 'Book not found',
            message: `No book found with slug: ${params.slug}`,
            status: 404
          }), 
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } catch (error) {
      console.error('Error fetching book:', error);
      return new NextResponse(
        JSON.stringify({ 
          error: 'Internal server error',
          message: 'An error occurred while fetching the book',
          status: 500
        }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get the current year for the copyright notice
    const currentYear = new Date().getFullYear();
    const publishYear = book.publishYear || currentYear;

    console.log(`Generating imprint for book: ${book.id}`);

    // Generate the imprint HTML
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

    console.log(`Successfully generated imprint for book ${book.id} in ${Date.now() - requestStart}ms`);

    // Return the HTML response with proper headers
    return new NextResponse(imprintHTML, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    });
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
