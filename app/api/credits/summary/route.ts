// app/api/credits/summary/route.ts
import 'server-only';

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
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
    
    // First try to get user from Clerk auth
    let clerkUserId: string | null = null;
    
    try {
      console.log('[Credits/Summary] Attempting Clerk auth');
      const authResult = await auth();
      clerkUserId = authResult.userId;
      console.log('[Credits/Summary] Clerk auth successful, userId:', clerkUserId);
    } catch (error) {
      console.warn('[Credits/Summary] Clerk auth failed, trying Bearer token:', error);
    }
    
    // If no user from Clerk auth, try Bearer token
    if (!clerkUserId) {
      console.log('[Credits/Summary] No Clerk user ID, checking Bearer token');
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        console.log('[Credits/Summary] Found Bearer token, using as userId');
        clerkUserId = token;
      }
    }
    
    if (!clerkUserId) {
      console.error('[Credits/Summary] No user ID found in request');
      return new NextResponse("Unauthorized", { status: 401 });
    }
    
    // Get the database user ID from the Clerk user ID
    console.log(`[Credits/Summary] Looking up database user for clerkId: ${clerkUserId}`);
    const [user] = await db.select()
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
      
    if (!user) {
      console.error(`[Credits/Summary] No database user found for clerkId: ${clerkUserId}`);
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
