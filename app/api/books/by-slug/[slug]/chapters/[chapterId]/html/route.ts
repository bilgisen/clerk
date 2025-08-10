import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/db/drizzle';
import { books, chapters, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateChapterHTML, generateCompleteDocumentHTML } from '@/lib/generateChapterHTML';
import { auth } from '@clerk/nextjs/server';
import { verifyGithubOidc, OidcAuthError } from '@/lib/auth/verifyGithubOidc';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

type Chapter = typeof chapters.$inferSelect;
type Book = typeof books.$inferSelect;

// Match the BookWithChapters interface from generateChapterHTML
interface BookWithChapters extends Book {
  chapters?: Chapter[];
}

export async function GET(
  request: Request,
  { params }: { params: { slug: string; chapterId: string } }
) {
  try {
    // Properly handle params in Next.js 13+
    const [slug, chapterId] = await Promise.all([
      Promise.resolve(params.slug),
      Promise.resolve(params.chapterId)
    ]);
    
    const requestStart = Date.now();
    
    console.log(`[${new Date().toISOString()}] Request for book: ${slug}, chapter: ${chapterId}`);
    
    // Determine auth method: prefer GitHub OIDC (Authorization or ?token) for CI; else Clerk for user
    const hdrs = await headers();
    const url = new URL(request.url);
    const headerAuth = hdrs.get('authorization') || hdrs.get('Authorization') || '';
    const queryToken = url.searchParams.get('token') || '';
    const bearer = headerAuth || (queryToken ? `Bearer ${queryToken}` : '');
    let userId: string | null = null;
    let isCi = false;

    if (bearer.startsWith('Bearer ')) {
      const raw = bearer.substring('Bearer '.length).trim();
      try {
        const claims = await verifyGithubOidc(raw);
        if (claims) {
          isCi = true;
          console.log('Authenticated via GitHub OIDC for chapter HTML:', {
            repository: claims.repository,
            ref: claims.ref,
            workflow: claims.workflow,
          });
        }
      } catch (e) {
        if (e instanceof OidcAuthError) {
          console.warn('OIDC verification failed for chapter HTML:', e.code);
        } else {
          console.warn('OIDC verification error for chapter HTML, falling back to headers flag');
        }
      }
    }

    // Backward-compat: allow middleware to signal CI via header if present
    if (!isCi) {
      const authMethod = hdrs.get('x-auth-method');
      isCi = authMethod === 'oidc';
    }

    if (!isCi) {
      // User flow: require Clerk auth
      const session = await auth();
      userId = session?.userId || null;
      if (!userId) {
        console.warn('Unauthenticated request');
        return new NextResponse(
          JSON.stringify({ error: 'Unauthorized - Please sign in' }), 
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get the book and verify ownership in a single query
    const [book] = await db
      .select({
        // Include all book fields we need
        id: books.id,
        userId: books.userId,
        title: books.title,
        slug: books.slug,
        description: books.description,
        language: books.language,
        coverImageUrl: books.coverImageUrl,
        subtitle: books.subtitle,
        author: books.author,
        isPublished: books.isPublished,
        isFeatured: books.isFeatured,
        genre: books.genre,
        tags: books.tags,
        publisher: books.publisher,
        publisherWebsite: books.publisherWebsite,
        publishYear: books.publishYear,
        isbn: books.isbn,
        contributor: books.contributor,
        translator: books.translator,
        series: books.series,
        seriesIndex: books.seriesIndex,
        viewCount: books.viewCount,
        epubUrl: books.epubUrl,
        createdAt: books.createdAt,
        updatedAt: books.updatedAt,
        publishedAt: books.publishedAt,
        // Join with users table to verify ownership
        ownerClerkId: users.clerkId,
      })
      .from(books)
      .innerJoin(users, eq(books.userId, users.id))
      .where(eq(books.slug, slug));

    if (!book) {
      console.error(`Book not found or access denied: ${slug}`);
      return new NextResponse('Book not found or access denied', { status: 404 });
    }

    // For CI (OIDC) allow access without ownership; for user flows enforce ownership
    if (!isCi) {
      // Verify the authenticated user owns this book
      if (book.ownerClerkId !== userId) {
        console.error('Access denied: User does not own this book', {
          bookId: book.id,
          bookTitle: book.title,
          ownerClerkId: book.ownerClerkId,
          requestingUserId: userId,
        });
        return new NextResponse('Access denied', { status: 403 });
      }
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
