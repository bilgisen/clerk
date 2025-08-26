import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/drizzle';
import { books, chapters } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { generateChapterHTML, generateCompleteDocumentHTML } from '@/lib/generateChapterHTML';
import { verifySecretToken } from '@/lib/auth/verifySecret';

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

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string; chapterId: string } }
) {
  try {
    const { slug, chapterId } = params;
    const requestStart = Date.now();
    
    console.log(`[${new Date().toISOString()}] Request for book: ${slug}, chapter: ${chapterId}`);

    // Get the book with proper error handling
    let book: BookWithChapters | undefined;
    try {
      const result = await db.execute(
        sql`SELECT * FROM books WHERE slug = ${slug} LIMIT 1`
      );
      book = result.rows[0] as BookWithChapters | undefined;

      if (!book) {
        console.error(`Book not found: ${slug}`);
        return new NextResponse(
          JSON.stringify({ error: 'Book not found' }), 
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } catch (error) {
      console.error('Error fetching book:', error);
      return new NextResponse(
        JSON.stringify({ error: 'Internal server error' }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get all chapters for the book in a single query using direct SQL
    let allChapters: Chapter[] = [];
    try {
      // Check if request is using secret token
      const isUsingSecretToken = await verifySecretToken(request);
      
      let query = `SELECT * FROM chapters WHERE book_id = $1 `;
      const params: (string | boolean)[] = [book.id];
      
      // Only filter out drafts if not using secret token
      if (!isUsingSecretToken) {
        query += `AND is_draft = false `;
      }
      
      query += `ORDER BY "order" ASC`;
      
      // Build the query with parameters directly in the SQL string
      const result = await db.execute(
        sql.raw(query.replace('$1', `'${book.id}'`))
      );
      allChapters = result.rows as Chapter[];
    } catch (error) {
      console.error('Error fetching chapters:', error);
      return new NextResponse(
        JSON.stringify({ error: 'Error fetching chapters' }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Debug: Log all chapter IDs and the one we're looking for
    console.log('All chapter IDs:', allChapters.map(c => c.id));
    console.log('Looking for chapter ID:', chapterId);
    console.log('All chapters:', JSON.stringify(allChapters, null, 2));
    
    // Find the requested chapter with case-insensitive comparison
    const chapter = allChapters.find(c => c.id.toLowerCase() === chapterId.toLowerCase());
    
    console.log('Found chapter:', chapter);
    
    if (!chapter) {
      console.error('Chapter not found:', { 
        chapterId, 
        bookId: book.id,
        availableChapters: allChapters.map(c => ({ id: c.id, title: c.title }))
      });
      return new NextResponse(
        JSON.stringify({ 
          error: 'Chapter not found',
          chapterId,
          availableChapters: allChapters.map(c => ({ id: c.id, title: c.title }))
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
    
    console.log('Child chapters:', childChapters);
    
    // Prepare book data for the template
    const bookWithChapters: BookWithChapters = {
      ...book,
      chapters: allChapters,
    };
    
    console.log('Book with chapters prepared');

    try {
      // Generate the HTML content
      console.log('Generating chapter HTML...');
      const chapterHTML = generateChapterHTML(chapter, childChapters, bookWithChapters);
      console.log('Generated chapter HTML, creating complete document...');
      
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
      console.error('Error generating HTML:', error);
      return new NextResponse(
        JSON.stringify({ 
          error: 'Failed to generate HTML',
          details: error instanceof Error ? error.message : 'Unknown error'
        }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
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

// Authentication is handled by middleware
