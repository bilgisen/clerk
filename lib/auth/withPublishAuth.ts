import { NextRequest, NextResponse } from "next/server";
import { verifyCombinedToken } from "./combined";
import { getSession } from "../store/redis";

// CombinedTokenClaims type from combined.ts
type CombinedTokenClaims = {
  // Standard JWT claims
  iss: string;         // Issuer (your application)
  sub: string;         // Subject (Clerk user ID)
  aud: string;         // Audience (should match COMBINED_JWT_AUD)
  exp: number;         // Expiration time (Unix timestamp)
  iat: number;         // Issued at (Unix timestamp)
  jti: string;         // JWT ID
  nbf?: number;        // Not before (Unix timestamp, optional)
  
  // Custom claims
  sid: string;         // Session ID (from publish session)
  scope: string;       // Token scope (e.g., 'publish')
  
  // Additional claims can be added here as needed
  [key: string]: any;  // Allow for additional custom claims
};

// Local error class for JWT verification
export class JWTVerificationError extends Error {
  code: string;
  
  constructor(message: string, code: string) {
    super(message);
    this.name = 'JWTVerificationError';
    this.code = code;
  }
}

export class AuthError extends Error {
  status: number;
  code: string;

  constructor(message: string, code: string, status = 403) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
  }

  toResponse(): NextResponse {
    return NextResponse.json(
      { error: this.message, code: this.code },
      { status: this.status }
    );
  }
}

/**
 * Middleware to protect routes that require a valid Combined Token
 * @param req Next.js request object
 * @returns The verified token claims
 * @throws {AuthError} If authentication fails
 */
export async function requireCombinedToken(req: NextRequest) {
  // Check for Authorization header
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("Missing or invalid Authorization header", "MISSING_AUTH_HEADER", 401);
  }

  const token = authHeader.slice("Bearer ".length);
  
  try {
    // Verify the token signature and basic claims
    const claims = await verifyCombinedToken(token);
    
    // Check if the session is still active
    const session = await getSession(claims.sid);
    if (!session) {
      throw new AuthError("Session not found", "SESSION_NOT_FOUND", 404);
    }
    
    // Check if the session has been aborted
    if (session.status === "aborted") {
      throw new AuthError("This session has been aborted", "SESSION_ABORTED");
    }
    
    // Check if the session has been completed (if applicable for the route)
    if (session.status === "completed") {
      throw new AuthError("This session has already been completed", "SESSION_COMPLETED");
    }
    
    // Verify that the token matches the session
    if (session.combinedToken && session.combinedToken !== token) {
      throw new AuthError("Token does not match session", "TOKEN_MISMATCH");
    }
    
    return claims;
  } catch (error: unknown) {
    if (error instanceof Error) {
      if ('code' in error && (error as any).code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
        throw new AuthError("Invalid token signature", "INVALID_TOKEN_SIGNATURE", 401);
      }
      throw new AuthError("Authentication failed: " + error.message, "AUTH_ERROR", 401);
    }
    throw new AuthError("Unknown authentication error", "UNKNOWN_AUTH_ERROR", 500);
  }
}

/**
 * Higher-order function to wrap API route handlers with Combined Token authentication
 * @param handler The API route handler function
 * @returns A wrapped handler that enforces authentication
 */
export function withPublishAuth<T = any>(
  handler: (
    req: NextRequest,
    { params }: { params: T },
    claims: Awaited<ReturnType<typeof requireCombinedToken>>
  ) => Promise<NextResponse> | NextResponse
) {
  return async function protectedHandler(
    req: NextRequest,
    { params }: { params: T }
  ): Promise<NextResponse> {
    try {
      const authHeader = req.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        throw new AuthError('Missing or invalid Authorization header', 'MISSING_AUTH_HEADER', 401);
      }
      const token = authHeader.split(' ')[1];
      
      // Verify the token and get claims
      const claims = await verifyCombinedToken(token);
      
      // Create a new request with updated headers
      const headers = new Headers(req.headers);
      headers.set('x-publish-session-id', claims.sid);
      headers.set('x-user-id', claims.sub);
      
      // Add auth info to the request object
      const authReq = req as NextRequest & { auth?: any };
      authReq.auth = {
        userId: claims.sub,
        sessionId: claims.sid,
        github: claims.gh
      };
      
      return NextResponse.next({
        request: {
          ...req,
          headers
        }
      });
    } catch (error: unknown) {
      if (error instanceof JWTVerificationError) {
        if (error.code === 'JWT_EXPIRED') {
          return NextResponse.json(
            { error: "Token expired" },
            { status: 401 }
          );
        }
        
        return NextResponse.json(
          { error: `Invalid token: ${error.message}` },
          { status: 401 }
        );
      }
      
      console.error("Publish auth error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}

/**
 * Middleware to check if the current user is the owner of the resource
 * @param req Next.js request object
 * @param ownerId The ID of the resource owner
 * @throws {AuthError} If the user is not authorized
 */
export function requireResourceOwner(
  req: NextRequest,
  ownerId: string
): void {
  const claims = req.auth;
  if (!claims) {
    throw new AuthError("Authentication required", "UNAUTHORIZED", 401);
  }
  
  if (claims.sub !== ownerId) {
    throw new AuthError("Not authorized to access this resource", "FORBIDDEN", 403);
  }
}

// Extend the global Request type to include our auth type
declare global {
  // This makes the auth property available on all Request objects
  interface Request {
    auth?: CombinedTokenClaims & {
      // Add any additional properties that should be available on req.auth
      userId: string;  // Alias for sub
      sessionId: string; // Alias for sid
      github?: any;    // GitHub OAuth data if needed
    };
  }
}

// Extend the NextRequest type to match our Request type
declare module "next/server" {
  interface NextRequest {
    auth?: CombinedTokenClaims & {
      userId: string;
      sessionId: string;
      github?: any;
    };
  }
}
