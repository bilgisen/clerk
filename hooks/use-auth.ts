import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface User {
  id: string;
  email: string;
  name?: string;
  role?: string;
  image?: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  // Fetch the current user
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async (): Promise<User | null> => {
      try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
          throw new Error('Not authenticated');
        }
        return response.json();
      } catch (error) {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });

  // Update state when user data changes
  useEffect(() => {
    setState({
      user: user || null,
      loading: isLoading,
      error: error ? (error as Error).message : null,
    });
  }, [user, isLoading, error]);

  // Sign out function
  const signOut = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
      });

      if (response.ok) {
        // Invalidate all queries
        await queryClient.invalidateQueries();
        // Redirect to home page
        router.push('/');
      }
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, [queryClient, router]);

  // Get authentication token
  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch('/api/auth/token');
      if (!response.ok) {
        throw new Error('Failed to get auth token');
      }
      const data = await response.json();
      return data.token || null;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }, []);

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    isAuthenticated: !!state.user,
    signOut,
    getToken,
  };
}
