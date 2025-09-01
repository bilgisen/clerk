import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/better-auth';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
    
    // Generate the authorization URL for Google OAuth
    const { url } = await auth.api.oauth.authorize('google', {
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback/google`,
      scope: 'openid email profile',
    });
    
    // Add the original callback URL to the state parameter for after OAuth flow
    const authUrl = new URL(url);
    authUrl.searchParams.set('state', JSON.stringify({ callbackUrl }));
    
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('Error in Google sign-in route:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Google sign-in' },
      { status: 500 }
    );
  }
}

// Handle POST requests the same way as GET for compatibility
export { GET as POST };
