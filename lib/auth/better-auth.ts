import { betterAuth } from 'better-auth';
import { customSession } from 'better-auth/plugins';
import { db } from '@/db/drizzle';
import type { User as DbUser } from '@/db/schema';
import type { User } from './auth-types';

// Environment configuration
const isProduction = process.env.NODE_ENV === 'production';
const baseURL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (isProduction
    ? 'https://editor.bookshall.com'
    : 'http://localhost:3000');
const domain = isProduction ? 'bookshall.com' : 'localhost';

// Extend the base User type with additional fields from our schema
export type ExtendedUser = DbUser & {
  roles?: string[];
  permissions?: string[];
};

// Auth configuration
export const auth = betterAuth({
  appName: 'Clerko',
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET!,

  // Database configuration using the shared Drizzle instance
  database: {
    client: db,
    type: 'pg' as const,
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60 // 5 minutes
    }
  },
  
  // Plugins
  plugins: [
    customSession(async ({ session, user }) => {
      // Safely extract first and last name from the user object or name string
      const userWithAny = user as any;
      const nameParts = typeof userWithAny.name === 'string' 
        ? userWithAny.name.split(' ')
        : [];
      
      const firstName = userWithAny.firstName || (nameParts[0] || '');
      const lastName = userWithAny.lastName || (nameParts.slice(1).join(' ') || '');
      
      return {
        user: {
          id: user.id,
          email: user.email,
          name: [firstName, lastName].filter(Boolean).join(' ') || user.email,
          firstName,
          lastName,
          image: userWithAny.imageUrl || user.image || null,
          role: userWithAny.role || 'MEMBER',
          permissions: userWithAny.permissions || []
        },
        session: session
      };
    })
  ],

  // Social providers
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    },
    ...(process.env.GITHUB_CLIENT_ID
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
          },
        }
      : {}),
  },

  // Cookies configuration
  cookies: {
    session: {
      name: '__Secure-next-auth.session-token',
      sameSite: 'lax',
      path: '/',
      secure: isProduction,
      ...(isProduction ? { domain: `.${domain}` } : {}),
    },
    csrf: {
      name: '__Secure-auth.csrf-token',
      sameSite: 'lax',
      path: '/',
      secure: isProduction,
      ...(isProduction ? { domain: `.${domain}` } : {}),
    },
    callback: {
      name: '__Secure-next-auth.callback-url',
      sameSite: 'lax',
      path: '/',
      secure: isProduction,
      ...(isProduction ? { domain: `.${domain}` } : {}),
    },
  },

  // JWT configuration
  jwt: {
    secret: process.env.BETTER_AUTH_JWT_SECRET,
    maxAge: 30 * 24 * 60 * 60, // 30 days
    encode: async ({
      secret,
      token,
      maxAge,
    }: {
      secret: string;
      token: any;
      maxAge: number;
    }) => {
      // Custom JWT encoding logic if needed
      return ''; // Return the encoded token
    },
    decode: async ({
      secret,
      token,
    }: {
      secret: string;
      token: string;
    }) => {
      // Custom JWT decoding logic if needed
      return null; // Return the decoded token
    },
  },

  // JWT callbacks
  callbacks: {
    async jwt({
      token,
      user,
    }: {
      token: any;
      user?: User;
    }) {
      if (user) {
        return {
          ...token,
          id: user.id,
          role: user.role || 'MEMBER',
          email: user.email,
          emailVerified: user.emailVerified,
        };
      }
      return token;
    },

    async session({
      session,
      token,
      user,
    }: {
      session: any;
      token: any;
      user: User;
    }) {
      if (session.user) {
        session.user = {
          ...session.user,
          id: user.id,
          role: user.role || 'MEMBER',
          email: user.email,
          name: user.name,
          firstName: (user as any).firstName,
          lastName: (user as any).lastName,
          image: user.image,
          emailVerified: user.emailVerified,
        };
      }
      return session;
    },

    async redirect({
      url,
      baseUrl,
    }: {
      url: string;
      baseUrl: string;
    }) {
      return url.startsWith(baseUrl) ? url : baseUrl;
    },

    async signIn({
      user,
      account,
    }: {
      user: User;
      account: any;
    }) {
      if (account?.provider === 'credentials') {
        return true;
      }
      return true;
    },
  },

  // Events
  events: {
    async signIn(message: string) {
      console.log('User signed in:', message);
    },
    async signOut(message: string) {
      console.log('User signed out:', message);
    },
    async createUser(user: User) {
      console.log('User created:', user.email);
    },
    async linkAccount(message: string) {
      console.log('Account linked:', message);
    },
    async error(error: Error) {
      console.error('Auth error:', error);
    },
  },

  // Debug mode in development
  debug: !isProduction,

  // Logger configuration
  logger: {
    disabled: false,
    level: isProduction ? 'error' : 'debug',
    log: (level: 'error' | 'warn' | 'info' | 'debug', message: string, ...args: any[]) => {
      if (level === 'debug' && isProduction) return;
      
      const logMessage = `[${level.toUpperCase()}] ${message}`;
      
      switch (level) {
        case 'error':
          console.error(logMessage, ...args);
          break;
        case 'warn':
          console.warn(logMessage, ...args);
          break;
        case 'info':
          console.info(logMessage, ...args);
          break;
        default:
          console.log(logMessage, ...args);
      }
    }
  },
});

// Export the auth instance
export type { ExtendedUser as User };
export default auth;