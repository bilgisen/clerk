import { NextResponse, NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/db/drizzle';
import { books, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateImprintHTML } from '@/lib/generateChapterHTML';
import { verifyGithubOidc } from '@/lib/auth/verifyGithubOidc';
import { getAuth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

type Book = typeof books.$inferSelect;

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
  { params }: { params: { slug: string } }
) {
  const requestStart = Date.now();
  
  try {
    const slug = params.slug;
    
    const authHeader = await headers();
    const headersObj = Object.fromEntries(Array.from(authHeader.entries()));
    const claims = await verifyRequest(new Headers(headersObj), request);
    
    console.log('GitHub OIDC token verified successfully for imprint:', {
      repository: claims.repository,
      ref: claims.ref,
      workflow: claims.workflow,
      actor: claims.actor,
      runId: claims.run_id
    });

    // Get the book with proper type safety and access control
    let bookResult;
    
    if (claims.type === 'clerk' && claims.userId) {
      // For Clerk auth, verify the user owns the book
      const result = await db
        .select()
        .from(books)
        .innerJoin(users, eq(books.userId, users.id))
        .where(and(
          eq(users.clerkId, claims.userId),
          eq(books.slug, slug)
        ))
        .limit(1);
      
      bookResult = result[0]?.books ? [result[0].books] : [];
    } else {
      // For GitHub OIDC or public access
      bookResult = await db
        .select()
        .from(books)
        .where(eq(books.slug, slug))
        .limit(1);
    }
    
    const book = bookResult[0];

    if (!book) {
      console.error(`Book not found with slug: ${slug} or access denied`);
      return new NextResponse(
        JSON.stringify({ error: 'Book not found or access denied' }), 
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating imprint for book: ${book.id}`);

    // Generate the imprint HTML
    const imprintHTML = generateImprintHTML({
      title: book.title,
      author: book.author || 'Unknown Author',
      publisher: book.publisher,
      publisherWebsite: book.publisherWebsite,
      publishYear: book.publishYear ? parseInt(book.publishYear.toString()) : null,
      isbn: book.isbn,
      language: book.language || 'en',
      description: book.description,
      coverImageUrl: book.coverImageUrl
    });

    console.log(`Successfully generated imprint for book ${book.id} in ${Date.now() - requestStart}ms`);

    // Return the HTML response with proper headers
    return new NextResponse(imprintHTML, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (error) {
    console.error('[IMPRINT_GET] Error:', error);
    return new NextResponse(
      JSON.stringify({ 
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), 
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}
