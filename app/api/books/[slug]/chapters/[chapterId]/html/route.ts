import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { currentUser } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { slug: string; chapterId: string } }
) {
  const { slug, chapterId } = params;
  const headersList = headers();
  const authHeader = headersList.get('authorization') || '';
  
  // Get the current URL and modify it to include /by-slug
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  pathParts.splice(3, 0, 'by-slug'); // Insert 'by-slug' after 'books'
  const newPath = pathParts.join('/');
  
  // Create a new URL with the modified path
  const newUrl = new URL(newPath, url.origin);
  
  // Forward all query parameters
  url.searchParams.forEach((value, key) => {
    newUrl.searchParams.set(key, value);
  });
  
  // Authentication logic
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
  
  // Convert headers to a plain object
  const headersObj: Record<string, string> = {};
  for (const [key, value] of headersList.entries()) {
    if (value) {
      headersObj[key] = value;
    }
  }
  
  try {
    // Make a request to the new URL with all original headers
    const response = await fetch(newUrl.toString(), {
      method: 'GET',
      headers: headersObj,
      redirect: 'manual' // Don't follow redirects automatically
    });
    
    // Forward the response
    const responseHeaders = new Headers(response.headers);
    
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    console.error('Error forwarding request:', error);
    return NextResponse.json(
      { 
        error: 'Internal Server Error',
        message: 'Failed to process the request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
