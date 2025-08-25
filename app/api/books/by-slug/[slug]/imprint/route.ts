import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/db/drizzle';
import { books, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateImprintHTML } from '@/lib/generateChapterHTML';
import { auth } from '@clerk/nextjs/server';
import { verifyGithubOidc, OidcAuthError } from '@/lib/auth/verifyGithubOidc';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

type Book = typeof books.$inferSelect;

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    // Properly handle params in Next.js 13+
    const [slug] = await Promise.resolve([params.slug]);
    
    const requestStart = Date.now();
    console.log(`[${new Date().toISOString()}] Request for book imprint: ${slug}`);
    
    // Determine auth method: prefer GitHub OIDC (Authorization or ?token) for CI; else Clerk for user
    const hdrs = await headers();
    const url = new URL(request.url);
    const headerAuth = hdrs.get('authorization') || hdrs.get('Authorization') || '';
    const queryToken = url.searchParams.get('token') || '';
    const bearer = headerAuth || (queryToken ? `Bearer ${queryToken}` : '');
    let userId: string | null = null;
    let isCi = false;

    if (bearer.startsWith('Bearer ')) {
      const raw = bearer.substring('Bearer '.length).trim();
      try {
        const claims = await verifyGithubOidc(raw);
        if (claims) {
          isCi = true;
          console.log('Authenticated via GitHub OIDC for imprint:', {
            repository: claims.repository,
            ref: claims.ref,
            workflow: claims.workflow,
            audience: claims.aud,
            issuer: claims.iss,
            subject: claims.sub
          });
          
          // Verify the token audience matches our expected API audience
          if (claims.aud !== process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
            console.error('Invalid audience in OIDC token for imprint:', claims.aud);
            return new NextResponse('Invalid token audience', { status: 403 });
          }
        }
      } catch (e) {
        console.error('OIDC verification error for imprint:', e);
        if (e instanceof OidcAuthError) {
          console.warn('OIDC verification failed for imprint:', e.code, e.message);
          return new NextResponse(`OIDC verification failed: ${e.message}`, { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          console.warn('Unexpected OIDC verification error for imprint:', e);
          return new NextResponse('Internal server error during authentication', { status: 500 });
        }
      }
    }

    // Backward-compat: allow middleware to signal CI via header if present
    if (!isCi) {
      const authMethod = hdrs.get('x-auth-method');
      isCi = authMethod === 'oidc';
    }

    if (!isCi) {
      // User flow: require Clerk auth
      const session = await auth();
      userId = session?.userId || null;
      if (!userId) {
        console.warn('Unauthenticated request');
        return new NextResponse(
          JSON.stringify({ error: 'Unauthorized - Please sign in' }), 
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

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

    // If not CI, verify user has access to this book
    if (!isCi) {
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkId, userId!))
        .limit(1);

      if (!user) {
        console.error(`User ${userId} not found in database`);
        return new NextResponse(
          JSON.stringify({ error: 'User not found' }), 
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (book.userId !== user.id) {
        console.error(`User ${userId} does not have access to book ${book.id}`);
        return new NextResponse(
          JSON.stringify({ error: 'Forbidden' }), 
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
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
