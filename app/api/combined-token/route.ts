import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/options';
import { verifyGithubOidc } from '@/lib/auth/github-oidc';
import { generateCombinedToken, verifyCombinedToken } from '@/lib/auth/combined-token';
import { getSession, updateSession } from '@/lib/store/redis';

export async function POST(request: Request) {
  try {
    // Verify GitHub OIDC token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response('Missing or invalid authorization header', { status: 401 });
    }

    const idToken = authHeader.split(' ')[1];
    let claims;
    
    try {
      claims = await verifyGithubOidc(idToken);
    } catch (error) {
      console.error('GitHub OIDC verification failed:', error);
      return new Response('Invalid GitHub OIDC token', { status: 401 });
    }

    // Extract session ID from the request body
    const { session_id } = await request.json();
    if (!session_id) {
      return new Response('Missing session_id in request body', { status: 400 });
    }

    // Get the publish session
    const session = await getSession(session_id);
    if (!session) {
      return new Response('Session not found', { status: 404 });
    }

    // Verify the nonce matches the GitHub run ID
    if (session.nonce !== claims.run_id) {
      return new Response('Invalid nonce', { status: 401 });
    }

    // Update session with GitHub context
    const updatedSession = await updateSession(session_id, {
      status: 'runner-attested',
      gh: {
        repository: claims.repository,
        run_id: claims.run_id,
        run_number: claims.run_number,
        workflow: claims.workflow,
        sha: claims.sha,
      },
    });

    if (!updatedSession) {
      return new Response('Failed to update session', { status: 500 });
    }

    // Generate combined token
    const privateKey = process.env.COMBINED_JWT_PRIVATE_KEY;
    const audience = process.env.COMBINED_JWT_AUDIENCE || 'clerk-actions';
    
    if (!privateKey) {
      console.error('COMBINED_JWT_PRIVATE_KEY is not set');
      return new Response('Server configuration error', { status: 500 });
    }

    const token = await generateCombinedToken(
      updatedSession,
      privateKey,
      audience
    );

    return NextResponse.json({
      token,
      expires_in: 15 * 60, // 15 minutes
      session_id: updatedSession.id,
      content_id: updatedSession.contentId,
    });

  } catch (error) {
    console.error('Error in combined-token endpoint:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    
    if (!token) {
      return new Response('Missing token parameter', { status: 400 });
    }

    const publicKey = process.env.COMBINED_JWT_PUBLIC_KEY;
    const audience = process.env.COMBINED_JWT_AUDIENCE || 'clerk-actions';
    
    if (!publicKey) {
      console.error('COMBINED_JWT_PUBLIC_KEY is not set');
      return new Response('Server configuration error', { status: 500 });
    }

    const payload = await verifyCombinedToken(token, publicKey, audience);
    
    // Get the latest session data
    const session = await getSession(payload.session_id);
    if (!session) {
      return new Response('Session not found', { status: 404 });
    }

    return NextResponse.json({
      valid: true,
      session_id: session.id,
      user_id: session.userId,
      content_id: session.contentId,
      status: session.status,
      expires_at: payload.exp,
    });

  } catch (error) {
    if (error.message === 'Token has expired') {
      return NextResponse.json(
        { valid: false, error: 'Token has expired' },
        { status: 401 }
      );
    }
    
    console.error('Token verification failed:', error);
    return NextResponse.json(
      { valid: false, error: 'Invalid token' },
      { status: 401 }
    );
  }
}
