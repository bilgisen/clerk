import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/db/drizzle';
import { books, chapters } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyToken } from '@/lib/auth';
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

function flattenChapterTree(chapters: ChapterWithChildren[], bookSlug: string, level = 1, parentId: string | null = null): PayloadChapter[] {
  return chapters.flatMap((chapter, index) => {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const result: PayloadChapter = {
      id: chapter.id,
      title: chapter.title,
      url: `${baseUrl}/api/books/by-slug/${bookSlug}/chapters/${chapter.id}/html`,
      level: level,
      order: index,
      parent: parentId,
      title_tag: `h${Math.min(level + 1, 6)}` as const,
    };

    const children = flattenChapterTree(chapter.children, bookSlug, level + 1, chapter.id);
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
    const authHeader = headersList.get('authorization') || '';
    
    // Verify authentication
    let userId: string | null = null;
    let isServiceAccount = false;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      
      console.log('🔑 JWT Token received, starting verification...');
      console.log('Token prefix:', token.substring(0, 20) + '...');
      
      try {
        // Import jose for JWT verification
        const { jwtVerify, createRemoteJWKSet } = await import('jose');
        
        // Get the JWKS URI from Clerk
        const jwksUri = `https://${process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.replace('_', ':')}/.well-known/jwks.json`;
        const JWKS = createRemoteJWKSet(new URL(jwksUri));
        
        // Get issuer and audience from environment variables with fallbacks
        const issuer = process.env.JWT_ISSUER || 'https://sunny-dogfish-14.clerk.accounts.dev';
        const audience = process.env.JWT_AUDIENCE || 'https://sunny-dogfish-14.clerk.accounts.dev';
        
        console.log('🔧 JWT Verification Config:', { issuer, audience });
        
        // Verify the JWT token
        const { payload } = await jwtVerify(token, JWKS, {
          issuer,
          audience,
          algorithms: ['RS256']
        });
        
        console.log('✅ JWT Token verified successfully:', {
          userId: payload.sub,
          issuer: payload.iss,
          audience: payload.aud,
          expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'no expiration',
          isExpired: payload.exp ? Date.now() >= payload.exp * 1000 : false
        });
        
        // Validate required claims
        const isValidAudience = Array.isArray(payload.aud) 
          ? payload.aud.includes(audience)
          : payload.aud === audience;
          
        if (!isValidAudience || payload.iss !== issuer) {
          console.error('❌ JWT validation failed: Invalid issuer or audience', {
            expected: { aud: audience, iss: issuer },
            received: { aud: payload.aud, iss: payload.iss }
          });
          throw new Error('Invalid token issuer or audience');
        }
        
        userId = payload.sub || null;
        isServiceAccount = true;
        
      } catch (error) {
        console.error('❌ JWT verification failed:', error instanceof Error ? error.message : 'Unknown error');
        // If JWT verification fails, try Clerk authentication as fallback
        try {
          const user = await currentUser();
          if (user) {
            console.log('🔑 Falling back to Clerk authentication');
            userId = user.id;
          } else {
            console.error('❌ No valid authentication method found');
          }
        } catch (userError) {
          console.error('❌ Clerk authentication failed:', userError instanceof Error ? userError.message : 'Unknown error');
        }
      }
    } else {
      // If no token, try to get current user from Clerk
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

    // Build chapter tree
    const chapterTree = buildChapterTree(bookResult.chapters);
    const flattenedChapters = flattenChapterTree(chapterTree, bookResult.slug);

    // Get base URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    // Construct the payload
    const payload: EbookPayload = {
      book: {
        slug: bookResult.slug,
        title: bookResult.title,
        language: bookResult.language || 'tr',
        output_filename: `${bookResult.slug}.epub`,
        cover_url: bookResult.coverImageUrl || '',
        stylesheet_url: `${baseUrl}/styles/ebook.css`,
        imprint: {
          url: `${baseUrl}/api/books/by-id/${bookId}/imprint`
        },
        chapters: flattenedChapters
      },
      options: {
        generate_toc: true,
        toc_depth: 3,
        language: bookResult.language || 'tr',
        embed_metadata: true,
        cover: !!bookResult.coverImageUrl
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
