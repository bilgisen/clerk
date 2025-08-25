import { NextResponse, NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/db/drizzle';
import { books, chapters, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyGithubOidc } from '@/lib/auth/verifyGithubOidc';
import { getAuth } from '@clerk/nextjs/server';
import { InferSelectModel } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

type Chapter = InferSelectModel<typeof chapters>;
type Book = {
  id: string;
  userId: string;
  title: string;
  slug: string;
  author: string;
  language: string;
  coverImageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  subtitle?: string | null;
  description?: string | null;
  publishedAt?: Date | null;
  // Add other fields as needed
};

type User = {
  id: string;
  clerkId: string;
  email: string;
  // Add other fields as needed
};

type AuthResult = {
  type: 'github' | 'clerk';
  userId?: string;
  repository?: string;
  ref?: string;
  workflow?: string;
  actor?: string;
  run_id?: string;
};

type BookWithUser = Book & {
  user?: User;
};

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
      title_tag: `h${Math.min(level + 1, 6)}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6',
    };

    const children = flattenChapterTree(chapter.children, bookSlug, baseUrl, level + 1, chapter.id);
    return [result, ...children];
  });
}

// Verify authentication (either Clerk or GitHub OIDC)
async function verifyRequest(headers: Headers, request: NextRequest): Promise<AuthResult> {
  // Check for Clerk token first (from Clerk-Authorization header)
  const clerkAuthHeader = headers.get('clerk-authorization') || headers.get('Clerk-Authorization') || '';
  
  if (clerkAuthHeader?.startsWith('Bearer ')) {
    try {
      // Remove the Clerk-Authorization header to prevent conflicts with getAuth()
      const modifiedRequest = new NextRequest(request);
      modifiedRequest.headers.delete('authorization');
      modifiedRequest.headers.delete('Authorization');
      
      const authObj = getAuth(modifiedRequest);
      if (authObj.userId) {
        console.log('Authenticated via Clerk');
        return { 
          type: 'clerk' as const, 
          userId: authObj.userId,
          // Add empty GitHub specific fields to satisfy TypeScript
          repository: '',
          ref: '',
          workflow: '',
          actor: '',
          run_id: ''
        };
      }
    } catch (clerkError) {
      console.log('Clerk authentication failed:', clerkError);
    }
  }
  
  // If no Clerk token or Clerk auth failed, try GitHub OIDC
  const githubAuthHeader = headers.get('authorization') || headers.get('Authorization') || '';
  
  if (!githubAuthHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }

  const token = githubAuthHeader.split(' ')[1];
  
  if (!token) {
    throw new Error('Missing token in Authorization header');
  }
  
  try {
    const claims = await verifyGithubOidc(token, {
      audience: process.env.GHA_OIDC_AUDIENCE,
      allowedRepo: process.env.GHA_ALLOWED_REPO,
      allowedRef: process.env.GHA_ALLOWED_REF,
    });
    
    console.log('Authenticated via GitHub OIDC');
    // Type assertion for GitHub claims
    const githubClaims = claims as {
      repository?: string;
      ref?: string;
      workflow?: string;
      actor?: string;
      run_id?: string;
    };
    
    return { 
      type: 'github' as const, 
      repository: githubClaims.repository || '',
      ref: githubClaims.ref || '',
      workflow: githubClaims.workflow || '',
      actor: githubClaims.actor || '',
      run_id: githubClaims.run_id || ''
    };
  } catch (githubError) {
    console.error('GitHub OIDC verification failed:', githubError);
    throw new Error('No valid authentication found');
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the book ID from params
    const bookId = params.id;
    
    // Verify GitHub OIDC token
    const headersList = await headers();
    const headersObj = Object.fromEntries(Array.from(headersList.entries()));
    const claims = await verifyRequest(new Headers(headersObj), request);
    
    console.log('Authentication successful:', {
      type: claims.type,
      userId: claims.userId,
      repository: claims.repository,
      ref: claims.ref,
      workflow: claims.workflow,
      actor: claims.actor,
      run_id: claims.run_id
    });

    // Get the book by ID with user verification for Clerk auth
    let book: Book | null = null;
    
    if (claims.type === 'clerk' && claims.userId) {
      // For Clerk auth, verify the user owns the book
      const result = await db.select()
        .from(books)
        .innerJoin(users, eq(books.userId, users.id))
        .where(and(
          eq(users.clerkId, claims.userId),
          eq(books.id, bookId)
        ))
        .limit(1);
      
      const dbBook = result[0]?.books;
      if (!dbBook) {
        book = null;
      } else {
        book = {
          id: dbBook.id,
          userId: dbBook.userId,
          title: dbBook.title || 'Untitled',
          slug: dbBook.slug || '',
          author: dbBook.author || 'Unknown',
          language: dbBook.language || 'tr',
          coverImageUrl: dbBook.coverImageUrl || null,
          createdAt: dbBook.createdAt || new Date(),
          updatedAt: dbBook.updatedAt || new Date(),
          subtitle: dbBook.subtitle || null,
          description: dbBook.description || null,
          publishedAt: dbBook.publishedAt || null
        };
      }
    } else {
      // For GitHub OIDC, just get the book by ID
      const result = await db.query.books.findFirst({
        where: eq(books.id, bookId)
      });
      
      if (!result) {
        book = null;
      } else {
        book = {
          id: result.id,
          userId: result.userId,
          title: result.title || 'Untitled',
          slug: result.slug || '',
          author: result.author || 'Unknown',
          language: result.language || 'tr',
          coverImageUrl: result.coverImageUrl || null,
          createdAt: result.createdAt || new Date(),
          updatedAt: result.updatedAt || new Date(),
          subtitle: result.subtitle || null,
          description: result.description || null,
          publishedAt: result.publishedAt || null
        };
      }
    }

    if (!book) {
      return NextResponse.json(
        { error: 'Book not found or access denied' },
        { status: 404 }
      );
    }
    
    const bookChapters = (await db.query.chapters.findMany({
      where: eq(chapters.bookId, book.id),
      orderBy: (chapters, { asc }) => [asc(chapters.order)],
    })) as Chapter[];

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
    const includeCover = (search.get('cover') ?? (book.coverImageUrl ? 'true' : 'false')).toLowerCase() === 'true';
    const style = (search.get('style') || 'default').toLowerCase();
    const tocDepth = Number(search.get('toc_depth') ?? '3');
    const languageOverride = search.get('language') || undefined;

    const stylesheetPath = style === 'style2' ? '/styles/ebook-style2.css' : '/styles/ebook.css';
    const outputExt = format === 'mobi' ? 'mobi' : 'epub';

    // Build chapter tree
    const chapterTree = buildChapterTree(bookChapters);
    const flattenedChapters = flattenChapterTree(chapterTree, book.slug, baseUrl);
    
    // Log chapter information for debugging
    console.log(`Found ${bookChapters.length} chapters for book ${book.id}`);
    console.log(`Flattened to ${flattenedChapters.length} chapters in the payload`);

    // Construct the payload
    const payload: EbookPayload = {
      book: {
        slug: book.slug,
        title: book.title,
        author: book.author || 'Unknown',
        language: languageOverride || book.language || 'tr',
        output_filename: `${book.slug}.${outputExt}`,
        cover_url: includeCover ? (book.coverImageUrl || '') : '',
        stylesheet_url: `${baseUrl}${stylesheetPath}`,
        ...(includeImprint ? { imprint: { url: `${baseUrl}/api/books/by-slug/${book.slug}/imprint` } } : {}),
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
