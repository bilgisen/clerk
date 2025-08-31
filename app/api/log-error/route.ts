import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const errorData = await request.json();
    
    // Log the error to your logging service
    console.error('Client-side error:', JSON.stringify(errorData, null, 2));
    
    // Here you can add additional error logging to services like:
    // - Sentry
    // - LogRocket
    // - Your custom logging solution
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error logging client error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to log error' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; // Ensure this runs on every request
