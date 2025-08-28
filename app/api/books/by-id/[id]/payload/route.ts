// app/api/books/by-id/[id]/payload/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db/drizzle';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { withOidcOnly } from '@/lib/middleware/withOidcOnly';
import { logger } from '@/lib/logger';

// Schema for query parameters
const queryParamsSchema = z.object({
  format: z.enum(['epub']).default('epub'),
  generate_toc: z.string().default('true').transform(val => val === 'true'),
  include_imprint: z.string().default('true').transform(val => val === 'true'),
  style: z.string().default('default'),
  toc_depth: z.string().default('3').transform(Number).refine(n => n >= 1 && n <= 6, {
    message: 'TOC depth must be between 1 and 6',
  }),
  language: z.string().optional(),
});

type QueryParams = z.infer<typeof queryParamsSchema>;

// Configuration
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const runtime = 'nodejs';

// Constants
const DEFAULT_LANGUAGE = 'en';
const MAX_CONTENT_LENGTH = 10 * 1024 * 1024; // 10MB

// Types
interface Chapter {
  id: string;
  bookId: string;
  title: string;
  content: any;
  order: number;
  parentChapterId: string | null;
  level?: number;
  isDraft?: boolean;
  publishedAt?: Date | null;
  slug?: string;
}

interface ChapterNode extends Chapter {
  children: ChapterNode[];
  slug: string;
}

interface PayloadChapter {
  id: string;
  title: string;
  slug: string;
  url: string;
  content_url: string;
  content: string;
  order: number;
  parent: string | null;
  title_tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
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
    subtitle?: string;
    description?: string;
    chapters: PayloadChapter[];
  };
  options: {
    generate_toc: boolean;
    toc_depth: number;
    embed_metadata: boolean;
    include_imprint: boolean;
    cover: boolean;
  };
  metadata?: {
    generated_at: string;
    generated_by: string;
    workflow_run_id?: string;
  };
}

// Helper function to build a tree structure from flat chapter list
function buildChapterTree(chapters: Chapter[]): ChapterNode[] {
  const chapterMap = new Map<string, ChapterNode>();
  const rootChapters: ChapterNode[] = [];

  // First pass: create all nodes
  for (const chapter of chapters) {
    const node: ChapterNode = {
      ...chapter,
      slug: chapter.slug || `chapter-${chapter.id.slice(0, 8)}`,
      children: [],
    };
    chapterMap.set(chapter.id, node);
  }

  // Second pass: build the tree
  for (const chapter of chapterMap.values()) {
    if (chapter.parentChapterId && chapterMap.has(chapter.parentChapterId)) {
      const parent = chapterMap.get(chapter.parentChapterId)!;
      parent.children.push(chapter);
    } else {
      rootChapters.push(chapter);
    }
  }

  // Sort children by order
  const sortChapters = (nodes: ChapterNode[]): ChapterNode[] => {
    return nodes
      .sort((a, b) => a.order - b.order)
      .map(node => ({
        ...node,
        children: sortChapters(node.children),
      }));
  };

  return sortChapters(rootChapters);
}

// Helper function to flatten chapter tree for payload
function flattenChapterTree(
  chapters: ChapterNode[],
  bookSlug: string,
  baseUrl: string,
  level = 1,
  parentId: string | null = null
): PayloadChapter[] {
  const result: PayloadChapter[] = [];
  
  for (const chapter of chapters) {
    const tag = (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const)[Math.min(level - 1, 5)];
    const slug = chapter.slug || `chapter-${chapter.id.slice(0, 8)}`;
    const url = `${baseUrl}/books/${bookSlug}/chapters/${slug}`;
    const contentUrl = `${url}/content`;

    const payloadChapter: PayloadChapter = {
      id: chapter.id,
      title: chapter.title,
      slug,
      url,
      content_url: contentUrl,
      content: chapter.content || '',
      order: chapter.order,
      parent: parentId,
      title_tag: tag,
    };

    result.push(payloadChapter);

    if (chapter.children.length > 0) {
      result.push(...flattenChapterTree(chapter.children, bookSlug, baseUrl, level + 1, chapter.id));
    }
  }

  return result;
}

// Helper function to get base URL
function getBaseUrl(request: NextRequest): string {
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('host') || 'clerko.com';
  return `${protocol}://${host}`;
}

async function handler(
  request: NextRequest,
  { params }: { params: { id: string } },
  oidcClaims: any
) {
  try {
    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const { format, generate_toc, include_imprint, style, toc_depth, language } = 
      queryParamsSchema.parse(searchParams);

    // Get the base URL for generating absolute URLs
    const baseUrl = getBaseUrl(request);
    const bookId = params.id;

    // Get the book
    const book = await db.query.books.findFirst({
      where: (books, { eq }) => eq(books.id, bookId),
    });

    if (!book) {
      logger.warn({
        message: 'Book not found',
        bookId,
      });
      return NextResponse.json(
        { 
          error: 'Book not found',
          code: 'BOOK_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    // Get all published chapters for the book
    const chapterResults = await db.query.chapters.findMany({
      where: (chapters, { eq, and }) => and(
        eq(chapters.bookId, bookId),
        eq(chapters.isDraft, false)
      ),
      orderBy: (chapters, { asc }) => [asc(chapters.order)]
    });
    
    // Build chapter tree and flatten for payload
    const chapterTree = buildChapterTree(chapterResults);
    const flattenedChapters = flattenChapterTree(chapterTree, book.slug, baseUrl);
    
    // Log the OIDC claims for auditing
    logger.info('OIDC-authenticated request', {
      repository: oidcClaims.repository,
      workflow: oidcClaims.workflow,
      run_id: oidcClaims.run_id,
      bookId
    });

    // Prepare the payload
    const payload: EbookPayload = {
      book: {
        slug: book.slug,
        title: book.title,
        author: book.author,
        language: language || book.language || DEFAULT_LANGUAGE,
        output_filename: `${book.slug}.${format}`,
        cover_url: book.coverImageUrl ? new URL(book.coverImageUrl, baseUrl).toString() : '',
        stylesheet_url: `${baseUrl}/styles/ebook-${style}.css`,
        ...(book.subtitle && { subtitle: book.subtitle }),
        ...(book.description && { description: book.description }),
        chapters: flattenedChapters,
      },
      options: {
        generate_toc,
        toc_depth,
        embed_metadata: true,
        include_imprint,
        cover: !!book.coverImageUrl,
      },
      metadata: {
        generated_at: new Date().toISOString(),
        generated_by: 'api',
      },
    };
    
    // Log successful payload generation
    logger.info({
      message: 'Generated book payload',
      bookId,
      chapterCount: flattenedChapters.length,
    });
    
    return NextResponse.json(payload);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error({
      message: 'Error generating book payload',
      error: new Error(errorMessage),
      stack: errorStack,
      bookId: params.id,
    });
    
    const status = error instanceof z.ZodError ? 400 : 500;
    const message = status === 500 ? 'Internal server error' : errorMessage;
    
    return NextResponse.json(
      { error: message, code: 'PAYLOAD_GENERATION_ERROR' },
      { status: status as number }
    );
  }
}

// Export the handler wrapped with OIDC-only middleware
export const GET = withOidcOnly(handler);
