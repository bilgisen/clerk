import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/db/drizzle';
import { books, chapters } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth, currentUser } from '@clerk/nextjs/server';

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

function flattenChapterTree(chapters: ChapterWithChildren[], bookSlug: string, level = 1, parentId: string | null = null, authToken: string = ''): PayloadChapter[] {
  const result: PayloadChapter[] = [];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  
  chapters.forEach((chapter, index) => {
    // Create the chapter URL with auth token if available
    let chapterUrl = `${baseUrl}/api/books/by-slug/${bookSlug}/chapters/${chapter.id}/html`;
    if (authToken) {
      chapterUrl += `?token=${encodeURIComponent(authToken)}`;
    }
    
    // Create the current chapter
    const currentChapter: PayloadChapter = {
      id: chapter.id,
      title: chapter.title,
      url: chapterUrl,
      level: level,
      order: index,
      parent: parentId,
      title_tag: `h${Math.min(level + 1, 6)}` as const,
    };
    
    // Add the current chapter to the result
    result.push(currentChapter);
    
    // Process children recursively if they exist
    if (chapter.children && chapter.children.length > 0) {
      const childChapters = flattenChapterTree(chapter.children, bookSlug, level + 1, chapter.id, authToken);
      result.push(...childChapters);
    }
  });
  
  return result;
}

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    // Get the slug from params
    const { slug } = await Promise.resolve(params);
    
    // Get user ID from Clerk session
    let userId: string | null = null;
    
    try {
      // Get the current user from Clerk
      const user = await currentUser();
      if (!user) {
        console.error('No authenticated user found');
        return NextResponse.json(
          { error: 'Unauthorized - Please sign in to access this resource' },
          { status: 401 }
        );
      }
      
      userId = user.id;
      console.log('Authenticated user:', { userId, email: user.emailAddresses[0]?.emailAddress });
      
    } catch (error) {
      console.error('Authentication error:', error);
      return NextResponse.json(
        { 
          error: 'Authentication failed', 
          details: error instanceof Error ? error.message : 'Unknown error',
          stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
        },
        { status: 401 }
      );
    }

    // Get the book with chapters
    const book = await db.query.books.findFirst({
      where: eq(books.slug, slug),
      with: {
        chapters: true,
      },
    });

    if (!book) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      );
    }

    // Log the raw chapters for debugging
    console.log('Raw chapters from DB:', JSON.stringify(book.chapters, null, 2));
    
    // Build chapter tree
    const chapterTree = buildChapterTree(book.chapters);
    console.log('Chapter tree:', JSON.stringify(chapterTree, null, 2));
    
    const flattenedChapters = flattenChapterTree(chapterTree, book.slug, 1, null, authToken);
    console.log('Flattened chapters:', JSON.stringify(flattenedChapters, null, 2));
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Construct the payload
    const payload: EbookPayload = {
      book: {
        slug: book.slug,
        title: book.title,
        language: book.language || 'tr',
        output_filename: `${book.slug}.epub`,
        cover_url: book.coverImageUrl ? new URL(book.coverImageUrl, baseUrl).toString() : '',
        stylesheet_url: new URL('/styles/epub.css', baseUrl).toString(),
        imprint: {
          url: new URL(`/api/books/by-slug/${book.slug}/imprint`, baseUrl).toString()
        },
        chapters: flattenedChapters
      },
      options: {
        generate_toc: true,
        toc_depth: 3,
        language: book.language || 'tr',
        embed_metadata: true,
        cover: !!book.coverImageUrl
      }
    };

    // Return the payload as JSON
    return NextResponse.json(payload);

  } catch (error) {
    console.error('Error generating payload:', error);
    return NextResponse.json(
      { error: 'Failed to generate payload' },
      { status: 500 }
    );
  }
}
