import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/better-auth';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    const state = url.searchParams.get('state');
    
    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/signin?error=auth_failed`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/signin?error=invalid_code`
      );
    }

    // Complete the OAuth flow
    const { user, error: authError } = await auth.api.oauth.callback('google', {
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback/google`,
    });

    if (authError || !user) {
      console.error('OAuth callback error:', authError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/signin?error=auth_failed`
      );
    }

    // Get the original callback URL from the state parameter
    let redirectUrl = '/dashboard';
    try {
      const stateObj = state ? JSON.parse(decodeURIComponent(state)) : {};
      if (stateObj.callbackUrl) {
        redirectUrl = stateObj.callbackUrl;
      }
    } catch (e) {
      console.error('Error parsing state:', e);
    }

    // Redirect to the original URL or dashboard
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${redirectUrl}`
    );

    // Set the session cookie
    response.cookies.set({
      name: 'auth-session',
      value: user.sessionToken || '',
      httpOnly: true,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error) {
    console.error('Error in Google callback:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/signin?error=server_error`
    );
  }
}

// Handle POST requests the same way as GET for compatibility
export { GET as POST };
