import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/db/drizzle';
import { books } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateImprintHTML } from '@/lib/generateChapterHTML';
import { verifyRequest } from '@/lib/verify-jwt';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

type Book = typeof books.$inferSelect;

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const requestStart = Date.now();
  
  try {
    // Verify authentication
    const auth = await verifyRequest(request);
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'html';

    if (format !== 'html' && format !== 'json') {
      return NextResponse.json(
        { error: 'Invalid format. Must be html or json' },
        { status: 400 }
      );
    }

    // Get the book with user details
    const book = await db.query.books.findFirst({
      where: (books, { eq }) => eq(books.slug, params.slug),
      with: {
        user: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!book) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      );
    }

    // For Clerk users, verify they own the book
    if (auth.type === 'clerk' && book.userId !== auth.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    console.log(`Generating imprint for book: ${book.id}`);

    // Generate the imprint HTML
    const imprintHTML = generateImprintHTML({
      title: book.title,
      author: book.author || 'Unknown Author',
      publisher: book.publisher,
      publisherWebsite: book.publisherWebsite,
      publishYear: book.publishYear ? parseInt(book.publishYear.toString()) : null,
      isbn: book.isbn,
      language: book.language || 'en',
      description: book.description,
      coverImageUrl: book.coverImageUrl
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
