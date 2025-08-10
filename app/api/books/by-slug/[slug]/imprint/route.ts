import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db/drizzle';
import { books, users } from '@/db/schema';
import { generateImprintHTML } from '@/lib/generateChapterHTML';
import { verifyToken } from '@/lib/auth';
import { headers } from 'next/headers';
import { verifyGithubOidc, OidcAuthError } from '@/lib/auth/verifyGithubOidc';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

export const config = {
  api: {
    bodyParser: false,
  },
  runtime: 'nodejs',
};

type Book = typeof books.$inferSelect;

export async function GET(
  request: Request,
  context: { params: { slug: string } }
) {
  // Await the params object to handle async nature of Next.js 13+ API routes
  const { slug } = await Promise.resolve(context.params);

  try {
    console.log(`[${new Date().toISOString()}] Request for book imprint: ${slug}`);
    
    // Log request details for debugging
    const requestHeaders = await headers();
    const url = new URL(request.url);
    // Prefer Authorization header; fall back to token query param for CI callers
    const headerAuth = requestHeaders.get('authorization') || '';
    const queryToken = url.searchParams.get('token') || '';
    const authHeader = headerAuth || (queryToken ? `Bearer ${queryToken}` : '');
    
    // Log request info (excluding sensitive headers)
    const requestInfo = {
      url: request.url,
      method: request.method,
      hasAuthHeader: !!authHeader
    };
    console.log('Request details:', JSON.stringify(requestInfo, null, 2));
    let userId: string | null = null;
    let ciAccess: boolean = false;

    // Check for JWT token in Authorization header (for GitHub Actions/Pandoc integration)
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      // Try GitHub OIDC first for CI
      try {
        const claims = await verifyGithubOidc(token);
        if (claims) {
          ciAccess = true;
          console.log('Authenticated via GitHub OIDC for CI workflow:', {
            repository: claims.repository,
            ref: claims.ref,
            workflow: claims.workflow,
          });
        }
      } catch (e) {
        if (e instanceof OidcAuthError) {
          console.warn('OIDC verification failed, will try app JWT fallback:', e.code);
        } else {
          console.warn('OIDC verification error, trying app JWT fallback');
        }
      }

      if (!ciAccess) {
        // Fallback to app-specific JWT used elsewhere
        const decoded = await verifyToken(token);
        if (decoded) {
          userId = decoded.userId;
          console.log('Authenticated via app JWT token for user:', userId);
        }
      }
    } else {
      // If no Bearer token, check for Clerk session
      const session = await auth();
      if (session.userId) {
        userId = session.userId;
        console.log('Authenticated via Clerk session for user:', userId);
      }
    }

    if (!userId && !ciAccess) {
      console.error('No valid authentication found (neither Clerk/JWT nor GitHub OIDC)');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Fetch the book by slug
    const bookResult = await db.query.books.findFirst({
      where: (books, { eq }) => eq(books.slug, slug),
    });

    if (!bookResult) {
      console.error(`Book not found with slug: ${slug}`);
      return new NextResponse('Book not found', { status: 404 });
    }

    // Get the user's ID from the database
    let userIdToCheck = userId;
    
    // If we have a Clerk user ID, try to find the corresponding user in the database
    if (userId && userId.startsWith('user_')) {
      try {
        const userProfile = await db.query.users.findFirst({
          where: (users, { eq }) => eq(users.clerkId, userId)
        });
        
        if (userProfile) {
          userIdToCheck = userProfile.id;
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    }

    // Check if the user owns the book
    const isOwner = bookResult.userId === userIdToCheck;
    
    if (!isOwner && !ciAccess) {
      console.error(`User ${userId} does not have access to book ${bookResult.id}`);
      console.log(`Book owner: ${bookResult.userId}, Requesting user: ${userId}, User ID to check: ${userIdToCheck}`);
      
      // If using JWT, check if there's a specific claim for this book
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const decoded = await verifyToken(token);
        
        // If token has a bookId claim, verify it matches the requested book
        if (decoded?.bookId && decoded.bookId !== bookResult.id) {
          return new NextResponse(
            JSON.stringify({ 
              error: 'Token does not have permission to access this book',
              bookId: bookResult.id
            }), 
            { 
              status: 403,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }
        
        // If we reach here, the JWT is valid and has access to this book
        console.log('JWT token has access to book:', bookResult.id);
      } else {
        return new NextResponse(
          JSON.stringify({ 
            error: 'You do not have permission to access this resource',
            bookId: bookResult.id,
            userId: userIdToCheck,
            bookOwnerId: bookResult.userId
          }), 
          { 
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }

    console.log(`Generating imprint for book: ${bookResult.id}`);

    // Generate the imprint HTML
    const imprintHTML = generateImprintHTML({
      title: bookResult.title,
      author: bookResult.author || 'Unknown Author',
      publisher: bookResult.publisher,
      publisherWebsite: bookResult.publisherWebsite,
      publishYear: bookResult.publishYear ? parseInt(bookResult.publishYear.toString()) : null,
      isbn: bookResult.isbn,
      language: bookResult.language || 'en',
      description: bookResult.description,
      coverImageUrl: bookResult.coverImageUrl
    });

    console.log(`Successfully generated imprint for book ${bookResult.id}`);

    return new NextResponse(imprintHTML, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('[IMPRINT_GET] Error:', error);
    return new NextResponse('Error generating imprint', { status: 500 });
  }
}
