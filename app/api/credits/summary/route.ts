// app/api/credits/summary/route.ts
import 'server-only';

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api-auth";
import { creditService } from "@/lib/services/credits/credit-service";
import { db } from "@/lib/db/server";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

// Force this route to be server-side only
// Remove the edge runtime as it might cause issues with database connections
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    console.log('[Credits/Summary] Starting summary request');
    
    // Get authenticated user
    const { user: authUser, error } = await requireAuth();
    if (error) return error;
    
    if (!authUser) {
      console.error('[Credits/Summary] No authenticated user found');
      return new NextResponse("Unauthorized", { status: 401 });
    }
    
    console.log(`[Credits/Summary] Authenticated user ID: ${authUser.id}`);
    
    // Get the database user
    console.log(`[Credits/Summary] Looking up database user for id: ${authUser.id}`);
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, authUser.id))
      .limit(1);
      
    if (!user) {
      console.error(`[Credits/Summary] No database user found for id: ${authUser.id}`);
      return new NextResponse("User not found", { status: 404 });
    }
    
    const userId = user.id;
    console.log(`[Credits/Summary] Found database user with ID: ${userId}`);

    // Fetch balance and recent activities in parallel
    console.log(`[Credits/Summary] Fetching balance and activities for user ${userId}`);
    const [balance, recentActivities] = await Promise.all([
      creditService.getBalance(userId),
      creditService.getRecentActivities(userId, 10)
    ]);
    
    console.log(`[Credits/Summary] Balance: ${balance}, Activities count: ${recentActivities.length}`);

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
