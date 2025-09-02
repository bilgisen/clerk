// better-auth.config.ts
import { betterAuth } from 'better-auth';
import { db } from '@/db';
import { sessions, verificationTokens } from '@/db/schema/auth';
import { users } from '@/db/schema';

// Create the auth configuration
export const auth = betterAuth({
  // Required: Your secret key for JWT signing
  secret: process.env.BETTER_AUTH_SECRET!,

  // Database configuration - using the shared database connection
  database: {
    client: db,
    type: 'pg' as const,
  },

  // User model configuration
  user: {
    table: users,
    fields: {
      id: 'id',
      email: 'email',
      emailVerified: 'emailVerified',
      name: 'firstName', // Simplified to use a single name field
      image: 'imageUrl',
      password: 'passwordHash',
      salt: 'salt',
      verificationToken: 'verificationToken',
      resetToken: 'resetToken',
      resetTokenExpires: 'resetTokenExpires',
      lastActiveAt: 'lastActiveAt',
      role: 'role',
      isActive: 'isActive',
      createdAt: 'createdAt',
      updatedAt: 'updatedAt'
    }
  },

  // Session configuration
  session: {
    table: sessions,
    fields: {
      token: 'token',
      expiresAt: 'expires_at',
      userId: 'user_id',
      ipAddress: 'ip_address',
      userAgent: 'user_agent',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    } as const,
    // Session expiration settings
    expiresIn: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60 // 24 hours
  },

  // Verification tokens configuration
  verificationTokens: {
    table: verificationTokens,
    fields: {
      identifier: 'identifier',
      token: 'token',
      expires: 'expires'
      // The verification_tokens table only has these three columns
    }
  },
  
  // JWT configuration
  jwt: {
    secret: process.env.BETTER_AUTH_SECRET!,
    maxAge: 30 * 24 * 60 * 60, // 30 days
    // The token will be used for API authentication
    // and will be included in the Authorization header as a Bearer token
  },

  // Authentication providers
  providers: {
    // Email/Password authentication
    emailPassword: {
      enabled: true,
      requireEmailVerification: true,
      passwordValidation: {
        minLength: 8,
        maxLength: 100,
        requireNumber: true,
        requireUppercase: true,
        requireSpecialChar: true
      },
      maxFailedAttempts: 5,
      lockoutDuration: 15 * 60, // 15 minutes in seconds
    },
    
    // OAuth providers
    google: {
      enabled: true,
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback/google`,
      scopes: ['profile', 'email']
    },
    
    // Conditional GitHub OAuth provider (only if GITHUB_CLIENT_ID is set)
    ...(process.env.GITHUB_CLIENT_ID ? {
      github: {
        enabled: true,
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        scopes: ['read:user', 'user:email']
      }
    } : {})
  },

  // Cookie configuration
  cookies: {
    // Session cookie settings
    session: {
      name: '__Secure-auth.session-token',
      httpOnly: true, // Prevent JavaScript access to the cookie
      sameSite: 'lax', // CSRF protection while allowing some cross-site usage
      path: '/', // Available on all paths
      secure: process.env.NODE_ENV === 'production', // Only sent over HTTPS in production
      maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
      domain: process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_APP_DOMAIN
        ? `.${process.env.NEXT_PUBLIC_APP_DOMAIN}` // Set domain for subdomains in production
        : undefined
    },
    // CSRF cookie settings
    csrf: {
      name: '__Secure-auth.csrf-token',
      httpOnly: false, // Allow JavaScript to read the CSRF token
      sameSite: 'strict', // Stricter than 'lax' for CSRF protection
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
      domain: process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_APP_DOMAIN
        ? `.${process.env.NEXT_PUBLIC_APP_DOMAIN}`
        : undefined
    }
  },

  // Enable debug mode in development
  debug: process.env.NODE_ENV === 'development',
});

export default auth;
