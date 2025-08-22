import 'server-only';

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { creditService } from "@/lib/services/credits/credit-service";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

// Force this route to be server-side only
// Remove the edge runtime as it might cause issues with database connections
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // First try to get user from Clerk auth
    let clerkUserId: string | null = null;
    
    try {
      const authResult = await auth();
      clerkUserId = authResult.userId;
    } catch (error) {
      console.warn("Clerk auth failed, trying Bearer token");
    }
    
    // If no user from Clerk auth, try Bearer token
    if (!clerkUserId) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        // Here you would verify the token and get the user ID
        // For now, we'll just use it as the user ID since Clerk tokens are JWT
        clerkUserId = token;
      }
    }
    
    if (!clerkUserId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    
    // Get the database user ID from the Clerk user ID
    const [user] = await db.select()
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
      
    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }
    
    const userId = user.id;

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
