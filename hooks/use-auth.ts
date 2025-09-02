'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

export interface User {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role?: string;
  emailVerified?: boolean | null;
}

export interface ExtendedUser extends User {
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
  lastActiveAt?: string | Date | null;
  lastLoginAt?: string | Date | null;
}

type AuthReturnType = {
  user: ExtendedUser | null;
  isLoading: boolean;
  isLoaded: boolean;
  userId?: string | null;
  error: string | null;
  signIn: (provider?: string) => Promise<void>;
  signOut: () => Promise<void>;
  getSession: () => Promise<{ user: ExtendedUser | null }>;
  getToken: () => Promise<string | null>;
};

export function useAuth(): AuthReturnType {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Fetch session on mount
  useEffect(() => {
    const fetchSession = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/auth/session');
        if (response.ok) {
          const data = await response.json();
          setUser(data.user || null);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Error fetching session:', err);
        setError('Failed to fetch session');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, []);

  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch('/api/auth/token');
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      return data.token || null;
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  }, []);

  const signIn = useCallback(async (provider?: string) => {
    try {
      setIsLoading(true);
      const redirectTo = window.location.pathname;
      const callbackUrl = `${window.location.origin}/api/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`;
      
      if (provider) {
        window.location.href = `/api/auth/signin/${provider}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
      } else {
        window.location.href = `/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
      }
    } catch (err) {
      console.error('Error during sign in:', err);
      setError('Failed to sign in');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      setIsLoading(true);
      await fetch('/api/auth/signout', { method: 'POST' });
      setUser(null);
      router.push('/signin');
    } catch (err) {
      console.error('Error signing out:', err);
      setError('Failed to sign out');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const getSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user || null);
        return { user: data.user || null };
      }
      return { user: null };
    } catch (err) {
      console.error('Error getting session:', err);
      return { user: null };
    }
  }, []);

  return {
    user,
    isLoading,
    isLoaded: !isLoading,
    userId: user?.id,
    error,
    signIn,
    signOut,
    getSession,
    getToken,
  };
}
