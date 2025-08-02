import { auth } from "@clerk/nextjs/server";
import { SignJWT, jwtVerify } from "jose";

// Get the JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-please-change-this-in-production";

// Create a JWT token for the current user
export async function createToken() {
  try {
    const session = await auth();
    const userId = session?.userId;
    
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const payload = {
      userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour expiration
    };

    const secret = new TextEncoder().encode(JWT_SECRET);
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .sign(secret);

    return token;
  } catch (error) {
    console.error("Error creating token:", error);
    throw new Error("Failed to create token");
  }
}

// Verify a JWT token
export async function verifyToken(token: string) {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    
    return {
      userId: payload.userId as string,
      iat: payload.iat as number,
      exp: payload.exp as number,
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
