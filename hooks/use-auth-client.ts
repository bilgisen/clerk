'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import authClient from '@/lib/auth/auth-client';

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  emailVerified?: boolean;
  lastActiveAt?: string | Date | null;
  lastLoginAt?: string | Date | null;
}

export interface UseAuthReturn {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  refetch: () => Promise<any>;
  getToken: () => Promise<string | null>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const checkSession = useCallback(async () => {
    try {
      const { data: sessionData, error: sessionError } = await authClient.getSession();

      if (sessionError) {
        console.error('Error fetching session:', sessionError);
        setUser(null);
        setError(sessionError.message);
        return;
      }

      if (sessionData?.user) {
        setUser({
          id: sessionData.user.id,
          email: sessionData.user.email || '',
          name: sessionData.user.name || null,
          image: sessionData.user.image || null,
          role: sessionData.user.role || null,
          firstName: sessionData.user.firstName || null,
          lastName: sessionData.user.lastName || null,
          emailVerified: Boolean(sessionData.user.emailVerified),
          lastActiveAt: sessionData.user.lastActiveAt
            ? new Date(sessionData.user.lastActiveAt)
            : null,
          lastLoginAt: sessionData.user.lastLoginAt
            ? new Date(sessionData.user.lastLoginAt)
            : null,
        });
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Error in checkSession:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch session');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [router, pathname]);

  // Fetch session when the component mounts or path changes
  useEffect(() => {
    checkSession();
  }, [pathname, checkSession]);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await authClient.signOut();
      // Also call the server-side signout to clear cookies
      await fetch('/api/auth/signout', { method: 'POST' });
      setUser(null);
      router.push('/sign-in');
    } catch (err) {
      console.error('useAuth signOut error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign out');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await authClient.getSession();
      if (error) throw error;
      
      if (data?.user) {
        setUser({
          id: data.user.id,
          email: data.user.email || '',
          name: data.user.name || null,
          image: data.user.image || null,
          role: data.user.role || null,
          firstName: data.user.firstName || null,
          lastName: data.user.lastName || null,
          emailVerified: Boolean(data.user.emailVerified),
          lastActiveAt: data.user.lastActiveAt || null,
          lastLoginAt: data.user.lastLoginAt || null,
        });
      } else {
        setUser(null);
      }
      
      setError(null);
      return data;
    } catch (err) {
      console.error('useAuth refetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to refetch');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/auth/token');
      if (!res.ok) return null;
      const data = await res.json();
      return data.token || null;
    } catch (err) {
      console.error('useAuth getToken error:', err);
      return null;
    }
  }, []);

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    signOut,
    refetch,
    getToken,
  };
}
