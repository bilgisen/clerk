import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/db/drizzle';
import { books, chapters } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateChapterHTML, generateCompleteDocumentHTML } from '@/lib/generateChapterHTML';
import { verifyGithubOidc } from '@/lib/auth/verifyGithubOidc';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

type Chapter = typeof chapters.$inferSelect;
type Book = typeof books.$inferSelect;

// Match the BookWithChapters interface from generateChapterHTML
interface BookWithChapters extends Book {
  chapters?: Chapter[];
}

// Verify GitHub OIDC token and return claims if valid
async function verifyRequest(headers: Headers) {
  const authHeader = headers.get('authorization') || headers.get('Authorization') || '';
  
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }

  const token = authHeader.split(' ')[1];
  
  if (!token) {
    throw new Error('Missing token in Authorization header');
  }
  
  try {
    const claims = await verifyGithubOidc(token, {
      audience: process.env.GHA_OIDC_AUDIENCE,
      allowedRepo: process.env.GHA_ALLOWED_REPO,
      allowedRef: process.env.GHA_ALLOWED_REF,
    });
    
    return claims;
  } catch (error) {
    console.error('GitHub OIDC verification failed:', error);
    throw new Error('Invalid or expired token');
  }
}

export async function GET(
  request: Request,
  { params }: { params: { slug: string; chapterId: string } }
) {
  try {
    const { slug, chapterId } = params;
    
    // Verify GitHub OIDC token
    const headersList = await headers();
    const claims = await verifyRequest(new Headers(headersList));
    
    console.log('GitHub OIDC token verified successfully for chapter HTML:', {
      repository: claims.repository,
      ref: claims.ref,
      workflow: claims.workflow,
      actor: claims.actor,
      runId: claims.run_id
    });
    
    const requestStart = Date.now();
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
    // The dates from the database are already Date objects, so we can use them directly
    const bookWithChapters: BookWithChapters = {
      ...book,
      chapters: allChapters,
      // No need to convert dates to strings as the Book type expects Date objects
      // The BookWithChapters interface extends Book, so it inherits the Date types
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
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache',
      },
    });
  }
}
