// lib/auth/better-auth-cli.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { users, sessions, verificationTokens } from '../../db/schema/auth';

// CLI için dummy config
const auth = betterAuth({
  database: {
    // runtime DB yok, adapter'ı dummy olarak geçiyoruz
    adapter: drizzleAdapter(undefined as any, {
      schema: { users, sessions, verificationTokens },
    }),
  },
  emailAndPassword: { enabled: false },
  socialProviders: {},
  plugins: [],
  session: { expiresIn: 60 * 60 * 24 * 7, freshAge: 60 * 60 * 24 },
});

export { auth };
