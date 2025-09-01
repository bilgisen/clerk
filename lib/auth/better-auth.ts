// lib/auth/better-auth.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { db } from '@/db';
import { users } from '@/db/schema';
import { sessions, verificationTokens } from '@/db/schema/auth';
import { eq } from 'drizzle-orm';

// Define types for better type safety
type User = typeof users.$inferSelect;
type Session = typeof sessions.$inferSelect;
type VerificationToken = typeof verificationTokens.$inferSelect;

// Initialize the auth instance
export const auth = betterAuth({
  // Required secret for session encryption
  secret: process.env.BETTER_AUTH_SECRET!,
  
  // Database configuration
  database: {
    adapter: drizzleAdapter(db, {
      users: {
        ...users,
        id: users.id,
        email: users.email,
        emailVerified: users.emailVerified,
        name: users.firstName,
        image: users.imageUrl,
        password: users.passwordHash,
      },
      sessions,
      verificationTokens,
      options: {
        provider: 'pg',
      },
    }),
  },
  
  // Session configuration
  session: {
    maxAge: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  
  // Social providers
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  
  // Enable/disable auth methods
  emailAndPassword: { enabled: false },
  
  // Cookies configuration
  cookies: {
    sessionToken: {
      name: '__Secure-authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  
  // Plugins
  plugins: [nextCookies()],
  
  // Callbacks
  callbacks: {
    async signIn({ user, account, profile }) {
      // Allow all sign-ins for now
      return true;
    },
    
    async session({ session, user }: { session: any; user?: any }) {
      if (session.user?.email) {
        const [dbUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, session.user.email))
          .limit(1);
          
        if (dbUser) {
          session.user.id = dbUser.id;
          session.user.role = dbUser.role;
        }
      }
      return session;
    },
    
    async jwt({ token, user, account, profile }) {
      // Add user ID and role to the JWT token
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    }
  },
});

// Default export for better-auth CLI
export default auth;
