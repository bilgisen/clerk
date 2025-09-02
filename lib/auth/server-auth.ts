import { auth } from './better-auth';
import { cookies } from 'next/headers';

interface User {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role?: string;
  emailVerified?: boolean | null;
}

export async function getServerSession() {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get('auth-token')?.value;
  
  if (!sessionToken) {
    return { user: null };
  }

  try {
    // Make a request to the session API endpoint
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/auth/session`, {
      headers: {
        Cookie: `auth-token=${sessionToken}`
      }
    });

    if (!response.ok) {
      return { user: null };
    }

    const data = await response.json();
    return { user: data.user || null };
  } catch (error) {
    console.error('Session verification failed:', error);
    return { user: null };
  }
}

export async function requireAuth() {
  const { user } = await getServerSession();
  
  if (!user) {
    throw new Error('Not authenticated');
  }
  
  return { user };
}
