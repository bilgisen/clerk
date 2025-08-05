import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

// Ensure process.env is typed
declare const process: {
  env: {
    NODE_ENV?: 'development' | 'production' | 'test';
    REVALIDATION_SECRET?: string;
  };
};

// This API route handles cache revalidation for specific tags
export async function POST(request: NextRequest) {
  try {
    // Get the revalidation secret from environment
    const expectedSecret = process.env.REVALIDATION_SECRET;
    
    // If no secret is set in environment, allow in development mode only
    if (!expectedSecret) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { message: 'Revalidation not configured' },
          { status: 500 }
        );
      }
      // In development, continue without secret check
    } else {
      // Verify the secret key for security in production
      const secret = request.nextUrl.searchParams.get('secret');
      if (secret !== expectedSecret) {
        console.error('Invalid revalidation token');
        return NextResponse.json(
          { message: 'Invalid token' },
          { status: 401 }
        );
      }
    }

    // Get the tag to revalidate
    const tag = request.nextUrl.searchParams.get('tag');
    if (!tag) {
      return NextResponse.json(
        { message: 'Missing tag parameter' },
        { status: 400 }
      );
    }

    // Revalidate the specific tag
    revalidateTag(tag);
    
    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (err) {
    console.error('Error revalidating:', err);
    return NextResponse.json(
      { message: 'Error revalidating' },
      { status: 500 }
    );
  }
}
