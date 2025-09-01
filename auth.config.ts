import { betterAuth } from 'better-auth';
import { db } from './db';

export const auth = betterAuth({
  // Database configuration
  database: {
    adapter: 'pg',
    db: db,
  },
  
  // Session configuration
  session: {
    // Session expiration in seconds (30 days)
    expiresIn: 30 * 24 * 60 * 60,
    // How often to update the session in seconds (1 day)
    updateAge: 24 * 60 * 60,
  },
  
  // Base URL for authentication callbacks
  baseUrl: process.env.AUTH_URL || 'http://localhost:3000',
  
  // Secret for signing cookies and tokens
  secret: process.env.AUTH_SECRET || 'your-secret-key',
  
  // Social providers configuration
  providers: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          access_type: 'offline',
          prompt: 'select_account consent',
        },
      },
      // Additional scopes can be added here if needed
      // scope: ['email', 'profile', 'https://www.googleapis.com/auth/drive.file'],
    },
  },
  
  // Email and password configuration
  credentials: {
    enabled: false,
  },
  
  // Enable debug mode in development
  debug: process.env.NODE_ENV === 'development',
});

export default auth;
