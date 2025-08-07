import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/db/drizzle';
import { books, chapters, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
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

// Use the Book type from the schema and extend it with chapters
interface BookWithChapters extends Book {
  chapters?: Chapter[];
}

function buildChapterTree(
  chapterList: Chapter[],
  parentId: string | null = null
): ChapterWithChildren[] {
  return chapterList
    .filter(
      (chapter): chapter is Chapter & { parentChapterId: string | null } =>
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
  try {
    const { slug, chapterId } = params;

    // Log the request details with timestamps
    const requestTime = new Date().toISOString();
    console.log(`[${requestTime}] Request for book: ${slug}, chapter: ${chapterId}`);
    console.log('Request URL:', request.url);

    console.log(`[${new Date().toISOString()}] Request for book: ${slug}, chapter: ${chapterId}`);
    console.log('Request headers:', Object.fromEntries(request.headers.entries()));

    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payload = await verifyToken(token);
      if (payload) {
        userId = payload.userId;
        console.log('Authenticated via JWT with user ID:', userId);
      }
    }

    if (!userId) {
      const clerkUser = await currentUser();
      if (!clerkUser) {
        console.error('No authenticated user');
        return new NextResponse('Unauthorized', { status: 401 });
      }
      userId = clerkUser.id;
      console.log('Authenticated via Clerk with user ID:', userId);
    }

    // Get the book with detailed logging and required fields
    console.log('Fetching book with slug:', slug);
    const book = await db.query.books.findFirst({
      where: (books, { eq }) => eq(books.slug, slug),
      columns: {
        id: true,
        userId: true,
        title: true,
        slug: true,
        description: true,
        language: true,
        coverImageUrl: true,
        subtitle: true,
        author: true,
        isPublished: true,
        isFeatured: true,
        genre: true,
        tags: true,
        publisher: true,
        publisherWebsite: true,
        publishYear: true,
        isbn: true,
        contributor: true,
        translator: true,
        series: true,
        seriesIndex: true,
        viewCount: true,
        epubUrl: true,
        createdAt: true,
        updatedAt: true,
        publishedAt: true,
      },
    });

    if (!book) {
      console.error(`Book not found with slug: ${slug}`);
      return NextResponse.json(
        { error: 'Book not found', slug },
        { status: 404 }
      );
    }

    console.log('Found book:', {
      id: book.id,
      title: book.title,
      userId: book.userId,
    });

    // Get the internal user ID from the users table using the Clerk user ID
    console.log('Looking up user with clerkId:', userId);
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);

    if (!dbUser) {
      console.error('User not found in database', { clerkId: userId });
      return NextResponse.json(
        { 
          error: 'User not found',
          message: 'No database user found for the authenticated Clerk user',
          clerkId: userId
        },
        { status: 404 }
      );
    }

    console.log('Found database user:', { 
      dbUserId: dbUser.id, 
      email: dbUser.email,
      clerkId: dbUser.clerkId 
    });

    // Check if the user owns the book using the internal user ID
    if (book.userId !== dbUser.id) {
      console.error('Access denied:', {
        reason: 'User does not own this book',
        bookId: book.id,
        bookTitle: book.title,
        bookOwnerId: book.userId,
        requestingUserId: dbUser.id,
        requestingUserClerkId: userId,
        isSameUser: book.userId === dbUser.id
      });
      return NextResponse.json(
        { 
          error: 'Access denied',
          message: 'You do not have permission to access this book',
          bookId: book.id,
          bookTitle: book.title,
          isOwner: book.userId === dbUser.id
        },
        { status: 403 }
      );
    }

    // Get all chapters for the book
    console.log('Fetching chapters for book:', book.id);
    const allChapters = await db.query.chapters.findMany({
      where: eq(chapters.bookId, book.id),
      orderBy: (chapters, { asc }) => [asc(chapters.order), asc(chapters.createdAt)],
    });

    console.log(`Found ${allChapters.length} chapters for book ${book.id}`);
    
    // Find the requested chapter
    const chapter = allChapters.find(c => c.id === chapterId);
    if (!chapter) {
      console.error('Chapter not found:', {
        chapterId,
        bookId: book.id,
        availableChapters: allChapters.map(c => c.id)
      });
      return NextResponse.json(
        { 
          error: 'Chapter not found',
          chapterId,
          bookId: book.id,
          availableChapters: allChapters.map(c => c.id)
        },
        { status: 404 }
      );
    }

    const chapterTree = buildChapterTree(allChapters);
    // Create the book with chapters object
    const bookWithChapters: BookWithChapters = {
      ...book,
      chapters: allChapters // Use the flat chapters array instead of tree
    };
    const childChapters = allChapters.filter(c => c.parentChapterId === chapter.id);

    const chapterHTML = generateChapterHTML(chapter, childChapters, bookWithChapters);

    const completeHTML = generateCompleteDocumentHTML(
      `${book.title || 'Untitled Book'} - ${chapter.title || 'Untitled Chapter'}`,
      chapterHTML
    );

    return new NextResponse(completeHTML, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[CHAPTER_HTML_GET] Error:', error);
    return new NextResponse('Error generating chapter HTML', { status: 500 });
  }
}
