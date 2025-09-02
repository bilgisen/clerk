import { createAuthClient } from 'better-auth/client';
import toast from 'sonner';
import type { 
  AuthError, 
  AuthResponse,
  User,
  ExtendedUser
} from './auth-types';

// Define missing types that were previously imported but not defined
export interface SessionData {
  user: User;
  accessToken: string;
  refreshToken?: string;
  expires: Date;
}

// Define missing option interfaces
export interface SignInOptions {
  email: string;
  password: string;
  [key: string]: any; // Allow additional properties
}

export interface SignUpOptions {
  email: string;
  password: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  image?: string | null;
  callbackUrl?: string;
  [key: string]: any; // Allow additional properties
}

export interface ForgotPasswordOptions {
  email: string;
}

export interface ResetPasswordOptions {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface ChangePasswordOptions {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface UpdateProfileOptions {
  [key: string]: any; // Allow any user update properties
}

export interface AuthClient {
  signIn: (options: SignInOptions) => Promise<AuthResponse<SessionData>>;
  signUp: (data: SignUpOptions) => Promise<AuthResponse<SessionData>>;
  signOut: (options?: { redirectTo?: string }) => Promise<AuthResponse<boolean>>;
  getSession: (options?: { required?: boolean }) => Promise<AuthResponse<SessionData | null>>;
  forgotPassword: (options: ForgotPasswordOptions) => Promise<AuthResponse<boolean>>;
  resetPassword: (params: ResetPasswordOptions) => Promise<AuthResponse<boolean>>;
  changePassword: (params: ChangePasswordOptions) => Promise<AuthResponse<boolean>>;
  refreshSession: () => Promise<AuthResponse<SessionData>>;
  updateProfile: (updates: UpdateProfileOptions) => Promise<AuthResponse<User>>;
  getUser: () => Promise<AuthResponse<User | null>>;
  getToken: () => Promise<string | null>;
  isAuthenticated: () => Promise<boolean>;
  getProviders: () => Promise<string[]>;
  signInWithProvider: (providerId: string, options?: any) => Promise<AuthResponse<SessionData>>;
  on: (event: string, callback: (data: any) => void) => void;
  useSession: () => { 
    data: SessionData | null; 
    status: 'loading' | 'authenticated' | 'unauthenticated'; 
    error: AuthError | null;
    update?: () => Promise<{ data: SessionData | null }>;
  };
}

// Create the better-auth client instance
const client = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_AUTH_URL || '/api/auth',
  debug: process.env.NODE_ENV === 'development',
});

// Helper function to handle API responses
const handleResponse = async <T>(
  promise: Promise<any>
): Promise<AuthResponse<T>> => {
  try {
    const result = await promise;
    
    if (result?.error) {
      const errorMessage = result.error.message || 'An error occurred';
      toast.error(errorMessage);
      
      // Create proper AuthError with required Error properties
      const authError: AuthError = Object.assign(new Error(errorMessage), {
        status: result.status || 500
      });
      
      return { 
        data: null, 
        error: authError,
        status: result.status || 500 
      };
    }
    
    if (!result?.data) {
      const error: AuthError = Object.assign(new Error('No data returned'), {
        status: 204
      });
      return { 
        data: null, 
        error,
        status: 204 
      };
    }
    
    return { 
      data: result.data as T, 
      error: null, 
      status: 200 
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    const authError: AuthError = Object.assign(new Error(errorMessage), {
      status: 500
    });
    toast.error(errorMessage);
    return { 
      data: null, 
      error: authError,
      status: 500 
    };
  }
};

// Map better-auth session to our SessionData type
const mapSession = (session: any): SessionData | null => {
  if (!session) return null;
  
  return {
    user: {
      ...session.user,
      // Ensure all required user fields are present with proper types
      id: session.user.id,
      email: session.user.email,
      emailVerified: session.user.emailVerified ? new Date(session.user.emailVerified) : null,
      name: session.user.name || null,
      imageUrl: session.user.imageUrl || null,
      createdAt: new Date(session.user.createdAt),
      updatedAt: new Date(session.user.updatedAt),
    },
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expires: new Date(session.expires)
  };
};

// Auth client implementation
const authClient: AuthClient = {
  // Sign in with email and password
  async signIn(options: SignInOptions) {
    return handleResponse<SessionData>(
      client.signIn.email(options)
    ).then((result) => {
      if (result.data) {
        return { ...result, data: mapSession(result.data) };
      }
      return result;
    });
  },
  
  // Sign up a new user
  async signUp(options: SignUpOptions) {
    // Prepare signUp options with proper typing
    const signUpOptions: any = {
      email: options.email,
      password: options.password,
      name: options.name || options.email.split('@')[0],
      callbackURL: options.callbackUrl
    };
    
    // Only add optional fields if they exist
    if (options.firstName) signUpOptions.firstName = options.firstName;
    if (options.lastName) signUpOptions.lastName = options.lastName;
    if (options.image && options.image !== null) signUpOptions.image = options.image;
    
    return handleResponse<SessionData>(
      client.signUp.email(signUpOptions)
    ).then((result) => {
      if (result.data) {
        return { ...result, data: mapSession(result.data) };
      }
      return result;
    });
  },
  
  // Sign out the current user
  async signOut(options?: { redirectTo?: string }) {
    if (options?.redirectTo) {
      window.location.href = options.redirectTo;
    }
    
    return handleResponse<boolean>(
      client.signOut()
    ).then((result) => ({
      ...result,
      data: result.data ? true : false
    }));
  },
  
  // Get the current session
  async getSession(options?: { required?: boolean }): Promise<AuthResponse<SessionData | null>> {
    const { required = false } = options || {};
    
    try {
      const result: any = await client.getSession();
      
      if (required && !result.data?.user) {
        const error: AuthError = Object.assign(new Error('Not authenticated'), {
          status: 401
        });
        return { 
          data: null, 
          error,
          status: 401 
        };
      }
      
      return {
        data: result.data ? mapSession(result.data) : null,
        error: result.error ? Object.assign(new Error(result.error.message), { status: result.status || 500 }) : null,
        status: result.status || (result.data ? 200 : 204)
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get session';
      const authError: AuthError = Object.assign(new Error(message), {
        status: 500
      });
      return { 
        data: null, 
        error: authError,
        status: 500 
      };
    }
  },
  
  // Request a password reset
  async forgotPassword(options: ForgotPasswordOptions) {
    try {
      const result: any = await client.forgetPassword({ email: options.email });
      if (result.error) {
        throw new Error(result.error.message);
      }
      return { 
        data: true,
        error: null,
        status: 200
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send password reset email';
      toast.error(message);
      const authError: AuthError = Object.assign(new Error(message), {
        status: 500
      });
      return { 
        data: false,
        error: authError,
        status: 500 
      };
    }
  },
  
  // Reset password with a token
  async resetPassword({ token, password, confirmPassword }: ResetPasswordOptions) {
    if (password !== confirmPassword) {
      const authError: AuthError = Object.assign(new Error('Passwords do not match'), {
        status: 400
      });
      return { 
        data: false,
        error: authError,
        status: 400 
      };
    }
    
    try {
      const result: any = await client.resetPassword({ newPassword: password, token });
      if (result.error) {
        throw new Error(result.error.message);
      }
      return { 
        data: true,
        error: null,
        status: 200
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset password';
      toast.error(message);
      const authError: AuthError = Object.assign(new Error(message), {
        status: 500
      });
      return { 
        data: false,
        error: authError,
        status: 500 
      };
    }
  },
  
  // Change password when authenticated
  async changePassword({ currentPassword, newPassword, confirmNewPassword }: ChangePasswordOptions) {
    if (newPassword !== confirmNewPassword) {
      const authError: AuthError = Object.assign(new Error('New passwords do not match'), {
        status: 400
      });
      return { 
        data: false,
        error: authError,
        status: 400 
      };
    }
    
    try {
      const result: any = await client.changePassword({ currentPassword, newPassword });
      if (result.error) {
        throw new Error(result.error.message);
      }
      return { 
        data: true,
        error: null,
        status: 200
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update password';
      toast.error(message);
      const authError: AuthError = Object.assign(new Error(message), {
        status: 500
      });
      return { 
        data: false,
        error: authError,
        status: 500 
      };
    }
  },
  
  // Refresh the current session
  async refreshSession() {
    try {
      const result: any = await client.getSession();
      if (result.error) {
        throw new Error(result.error.message);
      }
      return { 
        data: result.data ? mapSession(result.data) : null,
        error: null,
        status: result.data ? 200 : 204
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh session';
      const authError: AuthError = Object.assign(new Error(message), {
        status: 500
      });
      return { 
        data: null,
        error: authError,
        status: 500 
      };
    }
  },
  
  // Update user profile
  async updateProfile(updates: UpdateProfileOptions) {
    try {
      const result: any = await client.updateUser(updates);
      if (result.error) {
        throw new Error(result.error.message);
      }
      return { 
        data: result.data?.user || null,
        error: null,
        status: result.data ? 200 : 204
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update profile';
      toast.error(message);
      const authError: AuthError = Object.assign(new Error(message), {
        status: 500
      });
      return { 
        data: null,
        error: authError,
        status: 500 
      };
    }
  },
  
  // Get the current user
  async getUser() {
    try {
      const result: any = await client.getSession();
      if (result.error) {
        throw new Error(result.error.message);
      }
      return { 
        data: result.data?.user || null,
        error: null,
        status: result.data?.user ? 200 : 204
      };
    } catch (error) {
      return { 
        data: null,
        error: null,
        status: 204 
      };
    }
  },
  
  // Get a fresh access token from the token endpoint
  async getToken() {
    try {
      const response = await fetch('/api/auth/token', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch token');
      }

      const { token } = await response.json();
      return token || null;
    } catch (error) {
      console.error('Error fetching token:', error);
      return null;
    }
  },
  
  // Check if user is authenticated
  async isAuthenticated() {
    try {
      const result: any = await client.getSession();
      return !!result.data?.user;
    } catch {
      return false;
    }
  },
  
  // Get available OAuth providers
  async getProviders() {
    try {
      // Use the correct method to get social providers
      const response = await fetch(`${process.env.NEXT_PUBLIC_AUTH_URL || '/api/auth'}/social-providers`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch providers');
      }
      
      const data = await response.json();
      return data.providers || [];
    } catch (error) {
      console.error('Failed to fetch providers:', error);
      return [];
    }
  },
  
  // Sign in with OAuth provider
  async signInWithProvider(providerId: string, options?: any) {
    try {
      const result: any = await client.signIn.social({ provider: providerId, ...options });
      if (result.error) {
        throw new Error(result.error.message);
      }
      return { 
        data: result.data ? mapSession(result.data) : null,
        error: null,
        status: result.data ? 200 : 204
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sign in with provider';
      toast.error(message);
      const authError: AuthError = Object.assign(new Error(message), {
        status: 500
      });
      return { 
        data: null,
        error: authError,
        status: 500 
      };
    }
  },
  
 // Event handling
on(event: string, callback: (data: any) => void) {
  // @ts-ignore - better-auth client event handling
  return client.$events.on(event, callback);
},
  
  // React hook for session management
  useSession: () => {
    try {
      const session: any = client.getSession();
      
      return {
        data: session.data ? mapSession(session.data) : null,
        status: session.data ? 'authenticated' : 'unauthenticated',
        error: session.error ? Object.assign(new Error(session.error.message), { status: session.status || 500 }) : null,
        update: async () => {
          const newSession: any = await client.getSession();
          return { data: newSession.data ? mapSession(newSession.data) : null };
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get session';
      return {
        data: null,
        status: 'unauthenticated',
        error: Object.assign(new Error(message), { status: 500 })
      };
    }
  }
};

// Export the auth client
export default authClient;

// Export auth methods for convenience
export const {
  signIn,
  signUp,
  signOut,
  getSession,
  forgotPassword,
  resetPassword,
  changePassword,
  refreshSession,
  updateProfile,
  getToken,
  getUser,
  isAuthenticated,
  getProviders,
  signInWithProvider,
  on,
  useSession
} = authClient;