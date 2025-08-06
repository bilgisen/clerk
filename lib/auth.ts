import { auth } from "@clerk/nextjs/server";
import { SignJWT, jwtVerify } from "jose";

// Get the JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-please-change-this-in-production";

export interface JWTPayload {
  userId: string;
  bookId?: string;
  iat: number;
  exp: number;
  [key: string]: any; // Allow additional properties
}

// Create a JWT token for the current user
export async function createToken(payload: Omit<JWTPayload, 'iat' | 'exp'>) {
  try {
    const session = await auth();
    const userId = payload.userId || session?.userId;
    
    if (!userId) {
      throw new Error("User not authenticated and no userId provided in payload");
    }

    const tokenPayload = {
      ...payload,
      userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour expiration
    };

    const secret = new TextEncoder().encode(JWT_SECRET);
    const token = await new SignJWT(tokenPayload)
      .setProtectedHeader({ alg: "HS256" })
      .sign(secret);

    return token;
  } catch (error) {
    console.error("Error creating token:", error);
    throw new Error("Failed to create token");
  }
}

// Verify a JWT token
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    
    return {
      userId: payload.userId as string,
      bookId: payload.bookId as string | undefined,
      iat: payload.iat as number,
      exp: payload.exp as number,
      ...payload // Include any additional claims
    };
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}

// Get the current user from the JWT token
export async function getCurrentUser(token: string) {
  const payload = await verifyToken(token);
  if (!payload) return null;
  
  return {
    userId: payload.userId,
  };
}
