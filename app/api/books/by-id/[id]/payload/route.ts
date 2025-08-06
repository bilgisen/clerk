import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/db/drizzle';
import { books, chapters } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyToken } from '@/lib/auth';
import { currentUser } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

type Chapter = typeof chapters.$inferSelect;
type Book = typeof books.$inferSelect;

interface ChapterWithChildren extends Omit<Chapter, 'parentChapterId'> {
  children: ChapterWithChildren[];
  parentChapterId: string | null;
}

interface PayloadChapter {
  id: string;
  title: string;
  url: string;
  level: number;
  order: number;
  parent: string | null;
  title_tag: string;
}

interface EbookPayload {
  book: {
    slug: string;
    title: string;
    language: string;
    output_filename: string;
    cover_url: string;
    stylesheet_url: string;
    imprint: {
      url: string;
    };
    chapters: PayloadChapter[];
  };
  options: {
    generate_toc: boolean;
    toc_depth: number;
    language: string;
    embed_metadata: boolean;
    cover: boolean;
  };
}

function buildChapterTree(chapterList: Chapter[], parentId: string | null = null): ChapterWithChildren[] {
  return chapterList
    .filter((chapter): chapter is Chapter & { parentChapterId: string | null } =>
      chapter.parentChapterId === parentId
    )
    .sort((a, b) => a.order - b.order)
    .map(chapter => ({
      ...chapter,
      children: buildChapterTree(chapterList, chapter.id),
    }));
}

function flattenChapterTree(chapters: ChapterWithChildren[], bookSlug: string, level = 1, parentId: string | null = null): PayloadChapter[] {
  return chapters.flatMap((chapter, index) => {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const result: PayloadChapter = {
      id: chapter.id,
      title: chapter.title,
      url: `${baseUrl}/api/books/by-slug/${bookSlug}/chapters/${chapter.id}/html`,
      level: level,
      order: index,
      parent: parentId,
      title_tag: `h${Math.min(level + 1, 6)}` as const,
    };

    const children = flattenChapterTree(chapter.children, bookSlug, level + 1, chapter.id);
    return [result, ...children];
  });
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Get the book ID from params
    const { id: bookId } = await Promise.resolve(params);
    
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
          isServiceAccount = true; // Mark as service account for authorization
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
      return NextResponse.json(
        { error: 'Unauthorized - No valid authentication provided' },
        { status: 401 }
      );
    }

    // Get the book by ID
    const bookResult = await db.query.books.findFirst({
      where: eq(books.id, bookId),
      with: {
        chapters: true,
      },
    });

    if (!bookResult) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      );
    }

    // Build chapter tree
    const chapterTree = buildChapterTree(bookResult.chapters);
    const flattenedChapters = flattenChapterTree(chapterTree, bookResult.slug);

    // Get base URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    // Construct the payload
    const payload: EbookPayload = {
      book: {
        slug: bookResult.slug,
        title: bookResult.title,
        language: bookResult.language || 'tr',
        output_filename: `${bookResult.slug}.epub`,
        cover_url: bookResult.coverImageUrl || '',
        stylesheet_url: `${baseUrl}/styles/ebook.css`,
        imprint: {
          url: `${baseUrl}/api/books/by-id/${bookId}/imprint`
        },
        chapters: flattenedChapters
      },
      options: {
        generate_toc: true,
        toc_depth: 3,
        language: bookResult.language || 'tr',
        embed_metadata: true,
        cover: !!bookResult.coverImageUrl
      }
    };

    // Return the payload as JSON
    return NextResponse.json(payload);

  } catch (error) {
    console.error('Error generating payload by ID:', error);
    return NextResponse.json(
      { error: 'Failed to generate payload' },
      { status: 500 }
    );
  }
}
