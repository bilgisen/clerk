import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { jwt } from 'better-auth/plugins';
import { db } from '../../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import type { User as AuthUser, Account, Session } from 'better-auth';

// Create auth client for client-side usage
export const authClient = (() => {
  if (typeof window !== 'undefined') {
    const { createAuthClient } = require('better-auth/react');
    return createAuthClient({
      baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    });
  }
  return null;
})();

// Define custom user type that extends the base AuthUser
export interface BetterAuthUser extends Omit<AuthUser, 'id' | 'email' | 'name' | 'image'> {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Define session type
export interface BetterAuthSession extends Session {
  user: BetterAuthUser;
}

interface SignInResult {
  success: boolean;
  user?: BetterAuthUser;
  token?: string;
  error?: string;
}

interface SignUpResult {
  success: boolean;
  userId?: string;
  error?: string;
}

interface VerifySessionResult {
  user: BetterAuthUser | null;
  error?: string;
}

// Import Drizzle adapter
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

// Define the base auth configuration
const auth = betterAuth({
  // Configure database with Drizzle adapter
  database: {
    adapter: drizzleAdapter({
      db: db,
      tables: {
        users: 'users',
        accounts: 'accounts',
        sessions: 'sessions',
        verificationTokens: 'verification_tokens',
      },
    }),
  },
  
  // Configure Google OAuth provider
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      accessType: 'offline',
      prompt: 'select_account consent',
    },
  },
  
  // Configure plugins
  plugins: [
    // JWT plugin for token-based authentication
    jwt({
      secret: process.env.AUTH_SECRET!,
      maxAge: 60 * 60 * 24 * 7, // 1 week
    }),
    // Next.js cookies plugin for handling cookies in server components
    nextCookies()
  ],
  
  // Disable email/password authentication
  emailAndPassword: false,
  
  // Session configuration
  session: {
    maxAge: 60 * 60 * 24 * 7, // 1 week
    updateAge: 60 * 60 * 24, // 1 day
  },
  
  // Callbacks
  callbacks: {
    async signIn({ user: authUser, account }: { 
      user: BetterAuthUser; 
      account: Account | null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      profile?: any; 
    }) {
      // Ensure name is always defined
      const user = {
        ...authUser,
        name: authUser.name || authUser.email.split('@')[0]
      };
      // Check if user exists in your database
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, user.email!)
      });

      if (!existingUser) {
        // Create new user in your database
        await db.insert(users).values({
          email: user.email!,
          firstName: user.name?.split(' ')[0] || '',
          lastName: user.name?.split(' ').slice(1).join(' ') || '',
          imageUrl: user.image || '',
          isActive: true,
        });
      }
      
      return true;
    },
    
    async session({ session }: { 
      session: BetterAuthSession;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      token: any;
    }) {
      // Add custom session data
      if (session.user) {
        const dbUser = await db.query.users.findFirst({
          where: eq(users.email, session.user.email!)
        });
        
        if (dbUser) {
          session.user.id = dbUser.id;
          session.user.role = dbUser.role;
        }
      }
      
      return session;
    },
  },
});

// Export the auth instance
export { auth };

// Export types
export type { Session } from 'better-auth';

// Extend the Better-Auth types
declare module 'better-auth' {
  interface BetterAuthUser {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image?: string | null;
    role?: string;
    createdAt: Date;
    updatedAt: Date;
  }

  interface BetterAuth {
    // Add any additional methods you need here
    handler: (request: Request) => Promise<Response>;
  }
}

declare module 'better-auth' {
  interface BetterAuthUser {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image?: string | null;
    role?: string;
  }
}

// Get the current session with user data
export async function getAuth() {
  const response = await auth.handler(new Request('http://localhost'));
  const sessionData = await response.json() as BetterAuthSession;
  
  if (!sessionData?.user?.email) return null;
  
  const user = await db.query.users.findFirst({
    where: eq(users.email, sessionData.user.email)
  });
  
  if (!user) return null;
  
  return {
    userId: user.id,
    user: {
      id: user.id,
      email: user.email,
      name: [user.firstName, user.lastName].filter(Boolean).join(' '),
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      imageUrl: user.imageUrl,
    },
  };
}
