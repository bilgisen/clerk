import { auth } from './better-auth';
import { NextResponse, type NextRequest } from 'next/server';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  role: string;
}

// Return type for `requireAuth()`
export interface AuthResult {
  user?: AuthUser;
  error?: NextResponse;
}

/**
 * requireAuth
 * Checks if a user is authenticated using Better Auth.
 * @param request NextRequest or Request from the API route
 */
export async function requireAuth(request: NextRequest | Request): Promise<AuthResult> {
  try {
    // Get session from headers
    const sessionData = await auth.api.getSession({
      headers: request.headers,
    });

    const user = sessionData?.user;

    if (!user || !user.id) {
      return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    // Map session user to AuthUser type
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image ?? null,
      role: user.role ?? 'user',
    };

    return { user: authUser };
  } catch (err) {
    console.error('Auth error:', err);
    return { error: NextResponse.json({ error: 'Internal server error' }, { status: 500 }) };
  }
}

export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
  const result = await requireAuth(request);
  
  if (result.error) {
    return { error: result.error };
  }
  
  if (!result.user || result.user.role !== 'admin') {
    return {
      error: NextResponse.json(
        { error: 'Not authorized' }, 
        { 
          status: 403, 
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, max-age=0'
          } 
        }
      ),
    };
  }
  
  return { user: result.user };
}
