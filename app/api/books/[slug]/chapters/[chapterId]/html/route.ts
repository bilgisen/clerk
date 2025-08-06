import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { slug: string; chapterId: string } }
) {
  const { slug, chapterId } = params;
  const headersList = headers();
  
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
  
  // Forward all headers
  const headersObj: Record<string, string> = {};
  headersList.forEach((value, key) => {
    headersObj[key] = value;
  });
  
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
