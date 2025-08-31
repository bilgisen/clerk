import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    
    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Forward the request to the auth handler
    const response = await fetch(new URL('/api/auth/signin', request.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    // Get the response data
    const data = await response.json();

    // If there was an error, return it
    if (!response.ok) {
      return NextResponse.json(
        { message: data.error || 'Authentication failed' },
        { status: response.status }
      );
    }

    // Create a new response with the auth cookies
    const result = NextResponse.json(
      { message: 'Sign in successful', user: data.user },
      { status: 200 }
    );

    // Copy the auth cookies from the response
    const cookies = response.headers.getSetCookie();
    for (const cookie of cookies) {
      result.headers.append('Set-Cookie', cookie);
    }

    return result;
  } catch (error) {
    console.error('Sign in error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
