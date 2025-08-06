// app/api/books/by-slug/[slug]/chapters/[chapterId]/html/route.ts
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/db/drizzle';
import { books, chapters } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateChapterHTML, generateCompleteDocumentHTML } from '@/lib/generateChapterHTML';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

export const config = {
  api: {
    bodyParser: false,
  },
  runtime: 'nodejs',
};

type Chapter = typeof chapters.$inferSelect;
type Book = typeof books.$inferSelect;

interface ChapterWithChildren extends Omit<Chapter, 'parentChapterId'> {
  children: ChapterWithChildren[];
  parentChapterId: string | null;
}

interface BookWithChapters extends Book {
  chapters: ChapterWithChildren[];
}

function buildChapterTree(chapterList: Chapter[], parentId: string | null = null): ChapterWithChildren[] {
  return chapterList
    .filter((chapter): chapter is Chapter & { parentChapterId: string | null } =>
      chapter.parentChapterId === parentId
    )
    .map(chapter => ({
      ...chapter,
      children: buildChapterTree(chapterList, chapter.id),
    }));
}

export async function GET(
  request: Request,
  { params }: { params: { slug: string; chapterId: string } }
) {
  const { slug, chapterId } = params;

  try {
    console.log(`[${new Date().toISOString()}] Request for book: ${slug}, chapter: ${chapterId}`);
    
    // Log request details for debugging
    const requestInfo = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries())
    };
    console.log('Request details:', JSON.stringify(requestInfo, null, 2));

    // Get headers
    const headersList = await headers();
    const authHeader = headersList.get('authorization') || '';
    
    // Verify authentication
    let userId: string | null = null;
    let isServiceAccount = false;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      
      try {
        // First try to verify as a JWT token
        const decoded = await verifyToken(token);
        if (decoded) {
          userId = decoded.userId;
          isServiceAccount = true;
          console.log('Authenticated via JWT with user ID:', userId);
        }
      } catch (error) {
        console.error('JWT verification failed:', error);
        // If JWT verification fails, try Clerk authentication
        const user = await currentUser();
        if (user) {
          userId = user.id;
        }
      }
    } else {
      // If no token, try to get current user from Clerk
      const user = await currentUser();
      if (user) {
        userId = user.id;
      }
    }

    if (!userId) {
      console.error('No valid authentication provided');
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized - No valid authentication provided' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Find the book by slug with owner info
    const bookResult = await db.query.books.findFirst({
      where: eq(books.slug, slug),
      columns: {
        id: true,
        userId: true,
        title: true,
        slug: true,
        description: true
      }
    });

    if (!bookResult) {
      console.error(`Book not found with slug: ${slug}`);
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (bookResult.userId !== userId) {
      console.error(`Access denied - User ${userId} does not own book ${bookResult.id} (${bookResult.title})`);
      return NextResponse.json(
        { 
          error: 'Access denied',
          message: 'You do not have permission to access this resource',
          bookId: bookResult.id,
          requestedBy: userId
        },
        { status: 403 }
      );
    }

    // Get all chapters for the book
    const allChapters = await db.query.chapters.findMany({
      where: eq(chapters.bookId, bookResult.id),
      orderBy: (chapters, { asc }) => [asc(chapters.order), asc(chapters.createdAt)]
    });

    // Find the requested chapter
    const chapter = allChapters.find(c => c.id === chapterId);
    if (!chapter) {
      console.error(`Chapter not found with ID: ${chapterId} in book: ${bookResult.id}`);
      return NextResponse.json(
        { 
          error: 'Chapter not found',
          chapterId,
          bookId: bookResult.id
        },
        { status: 404 }
      );
    }

    // Build the chapter tree and generate HTML
    const chapterTree = buildChapterTree(allChapters);
    
    // Get the full book with all required properties
    const fullBook = await db.query.books.findFirst({
      where: eq(books.id, bookResult.id)
    });
    
    if (!fullBook) {
      console.error(`Book not found with ID: ${bookResult.id}`);
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      );
    }
    
    const bookWithChapters: BookWithChapters = {
      ...fullBook,
      chapters: chapterTree
    };
    
    const childChapters = allChapters.filter(c => c.parentChapterId === chapter.id);
    const chapterHTML = generateChapterHTML(chapter, childChapters, bookWithChapters);

    const completeHTML = generateCompleteDocumentHTML(
      `${bookResult.title || 'Untitled Book'} - ${chapter.title || 'Untitled Chapter'}`,
      chapterHTML
    );
    
    console.log(`Successfully generated HTML for chapter ${chapterId} in book ${bookResult.id}`);

    return new NextResponse(completeHTML, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('[CHAPTER_HTML_GET] Error:', error);
    return new NextResponse('Error generating chapter HTML', { status: 500 });
  }
}
