import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db';
import { users } from '@/db/schema';
import { sessions, verificationTokens } from '@/db/schema/auth';

// Minimal auth configuration for testing
const testAuth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET!,
  database: {
    adapter: {
      name: 'drizzle',
      client: db,
      tables: {
        users: {
          ...users,
          id: users.id,
          email: users.email,
          password: users.passwordHash,
          emailVerified: users.emailVerified,
          name: users.firstName,
          image: users.imageUrl,
        },
        sessions,
        verificationTokens,
      },
      options: {
        provider: 'pg',
      },
    },
  },
  session: {
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
});

console.log('✅ Auth instance created successfully');
console.log('Test completed');
