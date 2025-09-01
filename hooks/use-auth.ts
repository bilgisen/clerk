import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export interface User {
  id: string;
  email: string;
  name?: string;
  image?: string | null;
  role?: string;
  emailVerified?: boolean;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    error: null,
  });

  // Get current session
  const getSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session');
      
      if (!response.ok) {
        throw new Error('Failed to get session');
      }
      
      const data = await response.json();
      const user = data?.user || null;
      
      setState(prev => ({
        ...prev,
        user,
        isLoading: false,
        error: null,
      }));
      
      return user;
    } catch (error) {
      console.error('Error getting session:', error);
      setState(prev => ({
        ...prev,
        user: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to get session',
      }));
      return null;
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    getSession();
  }, [getSession]);

  // Sign out function
  const signOut = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to sign out');
      }
      
      setState({
        user: null,
        isLoading: false,
        error: null,
      });
      
      router.push('/sign-in');
    } catch (error) {
      console.error('Error signing out:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to sign out',
      }));
    }
  }, [router]);

  // Sign in with Google
  const signInWithGoogle = useCallback(async (options?: { redirectTo?: string }) => {
    try {
      const redirectTo = options?.redirectTo || '/dashboard';
      const callbackUrl = `${window.location.origin}${redirectTo}`;
      
      // Redirect to the sign-in endpoint with the provider
      window.location.href = `/api/auth/signin/google?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    } catch (error) {
      console.error('Error signing in with Google:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to sign in with Google',
      }));
      throw error;
    }
  }, []);

  // Get authentication token
  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch('/api/auth/token');
      if (!response.ok) {
        throw new Error('Failed to get auth token');
      }
      const { token } = await response.json();
      return token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }, []);

  return {
    ...state,
    isAuthenticated: !!state.user,
    signOut,
    signInWithGoogle,
    getToken,
    refresh: getSession,
  };
}
