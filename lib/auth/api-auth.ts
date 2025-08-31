import { NextResponse } from 'next/server';
import { getAuth } from './better-auth';

export async function requireAuth() {
  const authData = await getAuth();
  
  if (!authData?.user) {
    return {
      error: new NextResponse(
        JSON.stringify({ error: 'Not authenticated' }), 
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      ),
      user: null,
    };
  }

  return { user: authData.user, error: null };
}

export async function requireAdmin() {
  const { user, error } = await requireAuth();
  
  if (error) return { error, user: null };
  if (user?.role !== 'admin') {
    return {
      error: new NextResponse(
        JSON.stringify({ error: 'Not authorized' }), 
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      ),
      user: null,
    };
  }
  
  return { user, error: null };
}
