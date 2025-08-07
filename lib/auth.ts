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
  const tokenPrefix = token ? `${token.substring(0, 10)}...` : 'empty-token';
  const logContext = {
    operation: 'verifyToken',
    token: tokenPrefix,
    env: {
      JWT_ISSUER,
      JWT_AUDIENCE,
      NODE_ENV: process.env.NODE_ENV,
    },
  };
  
  // In development, allow bypassing auth if DISABLE_AUTH is set
  if (DISABLE_AUTH) {
    console.warn(`${LOG_PREFIX} WARNING: Authentication is disabled (development mode)`);
    return {
      userId: 'dev-user',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
  }

  try {
    if (!token) {
      console.error(`${LOG_PREFIX} ❌ No token provided`, logContext);
      return null;
    }

    console.log(`${LOG_PREFIX} 🔍 Verifying token: ${tokenPrefix}`, logContext);

    // Basic token format validation
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      console.error(`${LOG_PREFIX} ❌ Invalid token format`, { ...logContext, parts: tokenParts.length });
      return null;
    }

    // Try to decode the token for debugging
    let decodedPayload: any = null;
    try {
      const header = JSON.parse(Buffer.from(tokenParts[0], 'base64').toString());
      decodedPayload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
      console.log(`${LOG_PREFIX} 🔑 Decoded token`, {
        header,
        payload: {
          ...decodedPayload,
          iat: decodedPayload.iat ? new Date(decodedPayload.iat * 1000).toISOString() : null,
          exp: decodedPayload.exp ? new Date(decodedPayload.exp * 1000).toISOString() : null,
          nbf: decodedPayload.nbf ? new Date(decodedPayload.nbf * 1000).toISOString() : null,
        },
      });
    } catch (decodeError) {
      console.warn(`${LOG_PREFIX} ⚠️ Failed to decode token for debugging`, { 
        error: decodeError instanceof Error ? decodeError.message : 'Unknown error' 
      });
    }

    // Verify the JWT token
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET),
      {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        algorithms: ['HS256'],
        clockTolerance: 30, // 30 seconds tolerance for clock skew
      }
    );

    // Type assertion since we know the payload structure
    const jwtPayload = payload as JWTPayload;

    // Additional validation for required fields
    const userId = jwtPayload.userId || (jwtPayload.user && jwtPayload.user.id);
    if (!userId) {
      console.error(`${LOG_PREFIX} ❌ Token missing userId`, { 
        ...logContext, 
        payload: JSON.stringify(jwtPayload, null, 2) 
      });
      return null;
    }
    
    // Verify template if present
    if (jwtPayload.template && jwtPayload.template !== 'matbu') {
      console.error(`${LOG_PREFIX} ❌ Invalid template`, {
        ...logContext,
        expected: 'matbu',
        received: jwtPayload.template
      });
      return null;
    }

    // Validate issuer and audience
    if (jwtPayload.iss !== JWT_ISSUER) {
      console.error(`${LOG_PREFIX} ❌ Invalid issuer`, { 
        ...logContext, 
        expected: JWT_ISSUER, 
        received: jwtPayload.iss 
      });
      return null;
    }

    if (jwtPayload.aud !== JWT_AUDIENCE) {
      console.error(`${LOG_PREFIX} ❌ Invalid audience`, { 
        ...logContext, 
        expected: JWT_AUDIENCE, 
        received: jwtPayload.aud 
      });
      return null;
    }

    const duration = Date.now() - startTime;
    console.log(`${LOG_PREFIX} ✅ Token verified successfully`, {
      ...logContext,
      userId: jwtPayload.userId,
      iat: jwtPayload.iat ? new Date(jwtPayload.iat * 1000).toISOString() : 'no-iat',
      exp: jwtPayload.exp ? new Date(jwtPayload.exp * 1000).toISOString() : 'no-exp',
      duration: `${duration}ms`,
    });

    // Return the verified payload with default values for required fields
    return {
      ...jwtPayload,  // Spread first to allow overrides below
      userId: jwtPayload.userId,
      bookId: jwtPayload.bookId,
      iat: jwtPayload.iat || Math.floor(Date.now() / 1000),
      exp: jwtPayload.exp || Math.floor(Date.now() / 1000) + 3600
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = error instanceof Error ? error.name : 'UNKNOWN_ERROR';
    const isExpired = errorMessage.includes('expired');
    
    console.error(`${LOG_PREFIX} ❌ Token verification failed`, { 
      ...logContext,
      error: errorMessage,
      errorCode,
      isExpired,
      durationMs: Date.now() - startTime,
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3).join('\n') : undefined
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
