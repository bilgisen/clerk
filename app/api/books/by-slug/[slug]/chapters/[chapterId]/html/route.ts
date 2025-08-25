import { NextResponse, NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/db/drizzle';
import { books, chapters, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateChapterHTML, generateCompleteDocumentHTML } from '@/lib/generateChapterHTML';
import { verifyGithubOidc } from '@/lib/auth/verifyGithubOidc';
import { getAuth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

type Chapter = typeof chapters.$inferSelect;
type Book = typeof books.$inferSelect;

// Match the BookWithChapters interface from generateChapterHTML
interface BookWithChapters extends Book {
  chapters?: Chapter[];
}

type AuthResult = {
  type: 'github' | 'clerk';
  userId?: string;
  repository?: string;
  ref?: string;
  workflow?: string;
  actor?: string;
  run_id?: string;
};

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
          type: 'clerk', 
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
      type: 'github', 
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
  { params }: { params: { slug: string; chapterId: string } }
) {
  try {
    const { slug, chapterId } = params;
    
    // Verify GitHub OIDC token
    const authHeader = await headers();
    const headersObj = Object.fromEntries(Array.from(authHeader.entries()));
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
    
    // For Clerk auth, verify the user owns the book
    if (claims.type === 'clerk' && claims.userId) {
      const bookResult = await db.select()
        .from(books)
        .innerJoin(users, eq(books.userId, users.id))
        .where(and(
          eq(users.clerkId, claims.userId),
          eq(books.slug, params.slug)
        ))
        .limit(1);
        
      if (!bookResult.length) {
        console.error(`Access denied: User ${claims.userId} does not own book ${params.slug}`);
        return new NextResponse(
          JSON.stringify({ error: 'Access denied' }), 
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    
    console.log('GitHub OIDC token verified successfully for chapter HTML:', {
      repository: claims.repository,
      ref: claims.ref,
      workflow: claims.workflow,
      actor: claims.actor,
      runId: claims.run_id
    });
    
    const requestStart = Date.now();
    console.log(`[${new Date().toISOString()}] Request for book: ${slug}, chapter: ${chapterId}`);

    // Get the book
    const [book] = await db
      .select()
      .from(books)
      .where(eq(books.slug, slug))
      .limit(1);

    if (!book) {
      console.error(`Book not found: ${slug}`);
      return new NextResponse('Book not found', { status: 404 });
    }

    // Get all chapters for the book in a single query
    const allChapters = await db
      .select()
      .from(chapters)
      .where(eq(chapters.bookId, book.id))
      .orderBy(chapters.order, chapters.createdAt);

    // Find the requested chapter
    const chapter = allChapters.find(c => c.id === chapterId);
    if (!chapter) {
      console.error('Chapter not found:', { chapterId, bookId: book.id });
      return new NextResponse('Chapter not found', { status: 404 });
    }

    // Get direct child chapters
    const childChapters = allChapters.filter(c => c.parentChapterId === chapter.id);
    
    // Prepare book data for the template
    // The dates from the database are already Date objects, so we can use them directly
    const bookWithChapters: BookWithChapters = {
      ...book,
      chapters: allChapters,
      // No need to convert dates to strings as the Book type expects Date objects
      // The BookWithChapters interface extends Book, so it inherits the Date types
    };

    // Generate the HTML content
    const chapterHTML = generateChapterHTML(chapter, childChapters, bookWithChapters);
    const completeHTML = generateCompleteDocumentHTML(
      `${book.title || 'Untitled Book'} - ${chapter.title || 'Untitled Chapter'}`,
      chapterHTML
    );

    // Log successful response
    console.log(`Successfully generated HTML for chapter ${chapterId} in book ${book.id} [${Date.now() - requestStart}ms]`);

    return new NextResponse(completeHTML, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CHAPTER_HTML_GET] Error:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      params,
    });
    return new NextResponse('Error generating chapter HTML', { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache',
      },
    });
  }
}
