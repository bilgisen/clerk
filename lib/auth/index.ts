// Core authentication exports
export * from './better-auth';

type User = {
  id: string;
  email: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  imageUrl: string | null;
};

export interface AuthSession {
  userId: string;
  user: User | null;
}

export interface AuthResult {
  userId: string;
  user: User | null;
}

// For backward compatibility
export const auth = {
  getAuth: async (): Promise<AuthSession | null> => {
    const session = await import('./better-auth').then(m => m.getAuth());
    return session;
  },
  getAuthWithUser: async (): Promise<AuthResult> => {
    const session = await import('./better-auth').then(m => m.getAuth());
    return {
      userId: session?.userId || '',
      user: session?.user || null
    };
  }
};
export type { AuthContext } from '../types/auth';

// Export errors
export { 
  AuthError, 
  TokenValidationError, 
  PermissionDeniedError,
  RateLimitError,
  ConfigurationError,
  ProviderError 
} from './errors';
