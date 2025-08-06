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
  { params }: { params: { slug: string } }
) {
  try {
    // Get the slug from params
    const { slug } = await Promise.resolve(params);
    
    // Get headers
    const headersList = await headers();
    const authHeader = headersList.get('authorization') || '';
    
    // Verify authentication
    let userId: string | null = null;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = await verifyToken(token);
      if (decoded) {
        userId = decoded.userId;
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
        { error: 'Unauthorized' },
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

    // Build chapter tree
    const chapterTree = buildChapterTree(book.chapters);
    const flattenedChapters = flattenChapterTree(chapterTree, book.slug);
    
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
