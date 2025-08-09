import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/db/drizzle';
import { books, chapters } from '@/db/schema';
import { eq } from 'drizzle-orm';
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

function flattenChapterTree(chapters: ChapterWithChildren[], bookSlug: string, baseUrl: string, level = 1, parentId: string | null = null): PayloadChapter[] {
  return chapters.flatMap((chapter, index) => {
    const result: PayloadChapter = {
      id: chapter.id,
      title: chapter.title,
      url: `${baseUrl}/api/books/by-slug/${bookSlug}/chapters/${chapter.id}/html`,
      level: level,
      order: index,
      parent: parentId,
      title_tag: `h${Math.min(level + 1, 6)}` as const,
    };

    const children = flattenChapterTree(chapter.children, bookSlug, baseUrl, level + 1, chapter.id);
    return [result, ...children];
  });
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Get the book ID from params
    const bookId = params.id;
    
    // Get headers
    const headersList = await headers();
    const authMethod = headersList.get('x-auth-method');
    const oidcUser = headersList.get('x-auth-user-id');

    // Verify authentication: trust middleware signals
    let userId: string | null = null;
    let isServiceAccount = false;

    if (authMethod === 'oidc') {
      // Verified by middleware via GitHub OIDC
      isServiceAccount = true;
      userId = oidcUser || 'ci';
    } else {
      // Fall back to Clerk session for user flows
      try {
        const user = await currentUser();
        if (user) {
          userId = user.id;
        }
      } catch (error) {
        console.error('❌ Clerk authentication failed:', error instanceof Error ? error.message : 'Unknown error');
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

    // Determine base URL for absolute links
    const reqUrl = new URL(request.url);
    const configuredBase = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || '';
    const baseUrl = configuredBase || `${reqUrl.protocol}//${reqUrl.host}`;

    // Read publishing options from query params with sensible defaults
    const search = reqUrl.searchParams;
    const formatParam = (search.get('format') || 'epub').toLowerCase();
    const format = (formatParam === 'mobi' ? 'mobi' : 'epub') as 'epub' | 'mobi';
    const generateToc = (search.get('generate_toc') ?? 'true').toLowerCase() === 'true';
    const includeImprint = (search.get('include_imprint') ?? 'true').toLowerCase() === 'true';
    const includeCover = (search.get('cover') ?? (bookResult.coverImageUrl ? 'true' : 'false')).toLowerCase() === 'true';
    const style = (search.get('style') || 'default').toLowerCase();
    const tocDepth = Number(search.get('toc_depth') ?? '3');
    const languageOverride = search.get('language') || undefined;

    const stylesheetPath = style === 'style2' ? '/styles/ebook-style2.css' : '/styles/ebook.css';
    const outputExt = format === 'mobi' ? 'mobi' : 'epub';

    // Build chapter tree
    const chapterTree = buildChapterTree(bookResult.chapters);
    const flattenedChapters = flattenChapterTree(chapterTree, bookResult.slug, baseUrl);

    // Construct the payload
    const payload: EbookPayload = {
      book: {
        slug: bookResult.slug,
        title: bookResult.title,
        language: languageOverride || bookResult.language || 'tr',
        output_filename: `${bookResult.slug}.${outputExt}`,
        cover_url: includeCover ? (bookResult.coverImageUrl || '') : '',
        stylesheet_url: `${baseUrl}${stylesheetPath}`,
        imprint: {
          url: `${baseUrl}/api/books/by-id/${bookId}/imprint`
        },
        chapters: flattenedChapters
      },
      options: {
        generate_toc: generateToc,
        toc_depth: Number.isFinite(tocDepth) && tocDepth > 0 ? tocDepth : 3,
        language: languageOverride || bookResult.language || 'tr',
        embed_metadata: true,
        cover: includeCover
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
