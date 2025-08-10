import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/db/drizzle';
import { books, chapters } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth, currentUser } from '@clerk/nextjs/server';
import { verifyGithubOidc, OidcAuthError } from '@/lib/auth/verifyGithubOidc';

type Headers = ReturnType<typeof headers>;

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
    author: string;
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
    include_imprint: boolean;
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
    const { slug } = await Promise.resolve(params);
    // Find the book id for this slug
    const book = await db.query.books.findFirst({ where: eq(books.slug, slug) });
    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // Build base URL from request/env and redirect to by-id payload, preserving query params
    const reqUrl = new URL(request.url);
    const configuredBase = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || '';
    const baseUrl = configuredBase || `${reqUrl.protocol}//${reqUrl.host}`;
    const redirectUrl = new URL(`/api/books/by-id/${book.id}/payload`, baseUrl);
    reqUrl.searchParams.forEach((value, key) => {
      redirectUrl.searchParams.set(key, value);
    });

    return NextResponse.redirect(redirectUrl.toString(), { status: 302 });
  } catch (error) {
    console.error('Error redirecting to by-id payload:', error);
    return NextResponse.json(
      { error: 'Failed to resolve payload route' },
      { status: 500 }
    );
  }
}
