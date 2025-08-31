import { auth } from '@/lib/auth/better-auth';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Generate the authorization URL
    const { url, error } = await auth.api.signIn.social({
      provider: 'google',
      redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`,
    });

    if (error || !url) {
      console.error('Error generating Google OAuth URL:', error);
      return NextResponse.json(
        { error: 'Failed to initiate Google sign in' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Error in Google sign-in route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
