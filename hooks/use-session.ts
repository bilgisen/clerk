// hooks/use-session.ts
'use client';

import { useEffect, useState } from 'react';
import authClient, { type SessionData } from '@/lib/auth/auth-client';

interface UseSessionReturn {
  user: SessionData['user'] | null;
  session: SessionData | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  error: Error | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

export function useSession(): UseSessionReturn {
  const [session, setSession] = useState<SessionData | null>(null);
  const [user, setUser] = useState<SessionData['user'] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        setIsLoading(true);

        const { data: session, error: sessionError } = await authClient.getSession();
        
        if (sessionError) {
          throw sessionError;
        }

        if (session) {
          setSession(session);
          setUser(session.user || null);
        } else {
          setSession(null);
          setUser(null);
        }
      } catch (err) {
        console.error('Error in useSession:', err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred'));
        setSession(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();

    const refreshInterval = setInterval(fetchSession, 5 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, []);

  const signOut = async () => {
    try {
      const { error } = await authClient.signOut();
      if (error) {
        throw error;
      }
      setSession(null);
      setUser(null);
      window.location.href = '/';
    } catch (err) {
      console.error('Error signing out:', err);
      const errorObj = err instanceof Error ? err : new Error('Failed to sign out');
      setError(errorObj);
      throw errorObj;
    }
  };

  return {
    user,
    session,
    status: isLoading ? 'loading' : user ? 'authenticated' : 'unauthenticated',
    error,
    isLoading,
    signOut,
  };
}