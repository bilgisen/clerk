import { auth } from "@clerk/nextjs/server";
import { SignJWT, jwtVerify } from "jose";

// Get the JWT secret from environment variables
const JWT_SECRET = process.env.CLERK_JWT_KEY || process.env.JWT_SECRET || "your-secret-key-please-change-this-in-production";
const JWT_ISSUER = process.env.JWT_ISSUER || "clerk.clerko.v1";
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "https://api.clerko.com";

// Validate JWT secret
if (!JWT_SECRET || JWT_SECRET === "your-secret-key-please-change-this-in-production") {
  console.warn("WARNING: Using default JWT secret. Please set CLERK_JWT_KEY or JWT_SECRET in your environment variables.");
}

const LOG_PREFIX = '[Auth]';

// Environment variable to bypass auth in development
const DISABLE_AUTH = process.env.NODE_ENV === 'development' && process.env.DISABLE_AUTH === 'true';

export interface JWTPayload {
  userId: string;
  bookId?: string;
  iat: number;
  exp: number;
  [key: string]: any; // Allow additional properties
}

// Create a JWT token for the current user
export async function createToken(payload: Omit<JWTPayload, 'iat' | 'exp'>) {
  const startTime = Date.now();
  const logContext = {
    operation: 'createToken',
    payload: { ...payload, userId: payload.userId || 'not-provided' },
  };

  try {
    console.log(`${LOG_PREFIX} Creating token`, logContext);
    
    const session = await auth().catch(error => {
      console.warn(`${LOG_PREFIX} Clerk auth check failed`, { error: error.message });
      return null;
    });
    
    const userId = payload.userId || session?.userId;
    
    if (!userId) {
      const error = new Error("User not authenticated and no userId provided in payload");
      console.error(`${LOG_PREFIX} Authentication failed`, { ...logContext, error: error.message });
      throw error;
    }

    const tokenPayload = {
      ...payload,
      userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour expiration
    };

    console.log(`${LOG_PREFIX} Token payload prepared`, { ...logContext, userId });

    const secret = new TextEncoder().encode(JWT_SECRET);
    const token = await new SignJWT(tokenPayload)
      .setProtectedHeader({ alg: "HS256" })
      .sign(secret);

    const duration = Date.now() - startTime;
    console.log(`${LOG_PREFIX} Token created successfully`, { 
      ...logContext, 
      userId,
      tokenLength: token.length,
      durationMs: duration
    });

    return token;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIX} Error creating token`, { 
      ...logContext, 
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      durationMs: Date.now() - startTime
    });
    throw new Error(`Failed to create token: ${errorMessage}`);
  }
}

// Verify a JWT token
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  const startTime = Date.now();
  const logContext = {
    operation: 'verifyToken',
    tokenPrefix: token ? `${token.substring(0, 10)}...` : 'empty-token',
  };

  try {
    if (!token) {
      console.warn(`${LOG_PREFIX} Empty token provided`, logContext);
      return null;
    }

    console.log(`${LOG_PREFIX} Verifying token`, logContext);
    
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      clockTolerance: 30, // 30 seconds leeway for clock skew
    });

    // For GitHub Actions, we might get a 'sub' claim instead of 'userId'
    const userId = payload.userId || payload.sub;
    if (!userId) {
      console.error(`${LOG_PREFIX} Token missing userId/sub`, { ...logContext, payload });
      return null;
    }

    const result = {
      userId: String(userId),
      bookId: payload.bookId ? String(payload.bookId) : undefined,
      iat: Number(payload.iat) || Math.floor(Date.now() / 1000),
      exp: Number(payload.exp) || Math.floor(Date.now() / 1000) + 3600,
      // Include any additional claims from the token
      ...payload
    };
    
    // Log token validation success with basic info (don't log the full token for security)
    console.log(`${LOG_PREFIX} Token validated`, {
      userId: result.userId,
      issuer: payload.iss,
      audience: payload.aud,
      expiresIn: result.exp - Math.floor(Date.now() / 1000)
    });

    const duration = Date.now() - startTime;
    console.log(`${LOG_PREFIX} Token verified successfully`, { 
      ...logContext,
      userId: result.userId,
      expiresIn: result.exp - Math.floor(Date.now() / 1000),
      durationMs: duration
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = error instanceof Error ? error.name : 'UNKNOWN_ERROR';
    const isExpired = errorMessage.includes('expired');
    
    console.error(`${LOG_PREFIX} Token verification failed`, { 
      ...logContext,
      error: errorMessage,
      errorCode,
      isExpired,
      durationMs: Date.now() - startTime,
      stack: error instanceof Error ? error.stack : undefined
    });

    return null;
  }
}

// Get the current user from the JWT token
export async function getCurrentUser(token?: string) {
  const logContext = { operation: 'getCurrentUser' };
  
  try {
    if (!token) {
      console.warn(`${LOG_PREFIX} No token provided to getCurrentUser`, logContext);
      return null;
    }

    console.log(`${LOG_PREFIX} Getting current user`, { 
      ...logContext,
      tokenPrefix: token ? `${token.substring(0, 10)}...` : 'no-token'
    });

    const payload = await verifyToken(token);
    
    if (!payload) {
      console.warn(`${LOG_PREFIX} Invalid or expired token`, logContext);
      return null;
    }

    console.log(`${LOG_PREFIX} Current user resolved`, { 
      ...logContext,
      userId: payload.userId 
    });
    
    return {
      userId: payload.userId,
      ...(payload.bookId && { bookId: payload.bookId })
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIX} Error getting current user`, { 
      ...logContext, 
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    return null;
  }
}

// Helper to get user ID from request
export async function getUserIdFromRequest(request: Request): Promise<string | null> {
  // In development, allow bypassing auth if DISABLE_AUTH is set
  if (DISABLE_AUTH) {
    console.warn(`${LOG_PREFIX} WARNING: Authentication is disabled (development mode)`);
    return 'dev-user';
  }

  const authHeader = request.headers.get('authorization');
  
  // Check for Bearer token
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const payload = await verifyToken(token);
      if (payload) {
        console.log(`${LOG_PREFIX} Authenticated via JWT token`, { userId: payload.userId });
        return payload.userId;
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} JWT verification failed`, { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return null;
    }
  }
  
  // Fallback to Clerk session for web requests
  try {
    const session = await auth().catch(error => {
      console.warn(`${LOG_PREFIX} Clerk auth failed`, { error: error.message });
      return null;
    });
    
    if (session?.userId) {
      console.log(`${LOG_PREFIX} Authenticated via Clerk session`, { userId: session.userId });
      return session.userId;
    }
    
    console.warn(`${LOG_PREFIX} No valid authentication found`);
    return null;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error getting user from session`, { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return null;
  }
}
