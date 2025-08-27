import { NextResponse } from "next/server";
import { getSession } from "@/lib/store/redis";
import { withCombinedToken } from "@/lib/middleware/with-combined-token";

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  const handler = withCombinedToken(
    async (req, session) => {
      const { sessionId } = params;
      
      // Get the latest session data
      const currentSession = await getSession(sessionId);
      if (!currentSession) {
        return NextResponse.json(
          { error: "Session not found", code: "NOT_FOUND" },
          { status: 404 }
        );
      }
      
      // Return session status
      return NextResponse.json({
        sessionId: currentSession.id,
        status: currentSession.status,
        contentId: currentSession.contentId,
        progress: currentSession.progress,
        message: currentSession.message,
        phase: currentSession.phase,
        gh: currentSession.gh,
        createdAt: currentSession.createdAt,
        updatedAt: currentSession.updatedAt,
        completedAt: currentSession.completedAt,
        result: currentSession.result,
        error: currentSession.error
      });
    },
    { requireSession: false } // Allow checking status without a valid session
  );
  
  return handler(request);
}
