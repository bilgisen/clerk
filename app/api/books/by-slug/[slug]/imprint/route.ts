import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/db/drizzle';
import { books } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateImprintHTML } from '@/lib/generateChapterHTML';
import { verifyGithubOidc } from '@/lib/auth/verifyGithubOidc';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

type Book = typeof books.$inferSelect;

// Verify GitHub OIDC token and return claims if valid
async function verifyRequest(headers: Headers) {
  const authHeader = headers.get('authorization') || headers.get('Authorization') || '';
  
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
  { params }: { params: { slug: string } }
) {
  const requestStart = Date.now();
  
  try {
    const slug = params.slug;
    
    // Verify GitHub OIDC token
    const headersList = await headers();
    const claims = await verifyRequest(new Headers(headersList));
    
    console.log('GitHub OIDC token verified successfully for imprint:', {
      repository: claims.repository,
      ref: claims.ref,
      workflow: claims.workflow,
      actor: claims.actor,
      runId: claims.run_id
    });

    // Get the book with proper type safety
    const [book] = await db
      .select()
      .from(books)
      .where(eq(books.slug, slug))
      .limit(1);

    if (!book) {
      console.error(`Book not found with slug: ${slug}`);
      return new NextResponse(
        JSON.stringify({ error: 'Book not found' }), 
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
