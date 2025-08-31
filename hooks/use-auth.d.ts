import { User } from '../types/user';

declare module '@/hooks/use-auth' {
  interface AuthState {
    user: User | null;
    loading: boolean;
    error: string | null;
    isAuthenticated: boolean;
    signOut: () => Promise<void>;
    getToken: () => Promise<string | null>;
  }

  export function useAuth(): AuthState;
}
