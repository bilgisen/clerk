'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/auth/better-auth';

interface UserSession {
  id: string;
  email: string;
  name?: string;
  image?: string;
  role?: string;
}

export function useSession() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const getSession = async () => {
      try {
        setLoading(true);
        const session = await auth.getSession();
        setSession(session?.user || null);
      } catch (err) {
        console.error('Session error:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch session'));
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    // Set up session change listener if available
    const unsubscribe = auth.onAuthStateChange((user) => {
      setSession(user);
      setLoading(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await auth.signOut();
      setSession(null);
      window.location.href = '/';
    } catch (err) {
      console.error('Sign out error:', err);
      throw err;
    }
  };

  return {
    session,
    loading,
    error,
    signOut,
    isAuthenticated: !!session,
  };
}
