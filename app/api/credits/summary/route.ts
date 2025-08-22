import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { creditService } from "@/lib/services/credits/credit-service";

export const runtime = "edge"; // Optimize for read-only operations

export async function GET() {
  try {
    const authResult = await auth();
    const clerkUserId = authResult.userId;
    
    if (!clerkUserId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    
    // Use the Clerk user ID directly since we're not looking up a separate database user
    const userId = clerkUserId;

    // Fetch balance and recent activities in parallel
    const [balance, recentActivities] = await Promise.all([
      creditService.getBalance(userId),
      creditService.getRecentActivities(userId, 10)
    ]);

    return NextResponse.json({
      success: true,
      data: {
        balance,
        recentActivities: recentActivities
          .filter(activity => activity.createdAt !== null)
          .map(activity => ({
            id: activity.id,
            type: activity.type,
            title: activity.title,
            delta: activity.delta,
            ref: activity.ref,
            createdAt: activity.createdAt?.toISOString() ?? new Date().toISOString(),
          })),
      },
    });
  } catch (error) {
    console.error("Error fetching credit summary:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
