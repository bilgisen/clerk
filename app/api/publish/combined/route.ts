import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSession, updateSession } from "@/lib/store/redis";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    
    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId parameter", code: "MISSING_SESSION_ID" },
        { status: 400 }
      );
    }
    
    // Get the session
    const session = await getSession(sessionId);
    
    // Validate the session
    if (!session || session.userId !== userId) {
      return NextResponse.json(
        { error: "Session not found", code: "SESSION_NOT_FOUND" },
        { status: 404 }
      );
    }
    
    // Check if the session is in the correct state
    if (session.status !== "runner-attested" || !session.combinedToken) {
      return NextResponse.json(
        { 
          error: "Session not ready or already consumed",
          code: "SESSION_NOT_READY",
          status: session.status
        },
        { status: 425 } // 425 Too Early
      );
    }
    
    // Get the token and clear it from the session (one-time use)
    const combinedToken = session.metadata?.combinedToken as string | undefined;
    if (combinedToken) {
      await updateSession(sessionId, { 
        metadata: {
          ...session.metadata,
          combinedToken: undefined
        }
      });
    }
    
    return NextResponse.json({ combinedToken });
    
  } catch (error) {
    console.error("Combined token retrieval error:", error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message, code: "TOKEN_RETRIEVAL_ERROR" },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}
