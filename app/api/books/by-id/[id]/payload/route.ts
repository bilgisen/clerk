import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/db/drizzle';
import { books, chapters } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyGithubOidc } from '@/lib/auth/verifyGithubOidc';

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
    imprint?: {
      url: string;
    };
    chapters: PayloadChapter[];
  };
  options: {
    generate_toc: boolean;
    toc_depth: number;
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

// Verify GitHub OIDC token and return claims if valid
async function verifyRequest(headers: Headers) {
  const authHeader = headers.get('authorization');
  
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
  { params }: { params: { id: string } }
) {
  try {
    // Get the book ID from params
    const bookId = params.id;
    
    // Verify GitHub OIDC token
    const headersList = await headers();
    const headersObj = Object.fromEntries(Array.from(headersList.entries()));
    const claims = await verifyRequest(new Headers(headersObj));
    
    console.log('GitHub OIDC token verified successfully:', {
      repository: claims.repository,
      ref: claims.ref,
      workflow: claims.workflow,
      actor: claims.actor,
      runId: claims.run_id
    });

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
        author: bookResult.author || 'Unknown',
        language: languageOverride || bookResult.language || 'tr',
        output_filename: `${bookResult.slug}.${outputExt}`,
        cover_url: includeCover ? (bookResult.coverImageUrl || '') : '',
        stylesheet_url: `${baseUrl}${stylesheetPath}`,
        ...(includeImprint ? { imprint: { url: `${baseUrl}/api/books/by-slug/${bookResult.slug}/imprint` } } : {}),
        chapters: flattenedChapters
      },
      options: {
        generate_toc: generateToc,
        toc_depth: Number.isFinite(tocDepth) && tocDepth > 0 ? tocDepth : 3,
        embed_metadata: true,
        include_imprint: includeImprint,
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
