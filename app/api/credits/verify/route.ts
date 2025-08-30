import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db/server';
import { creditLedger } from '@/db/schema/credits';
import { and, eq } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const { checkoutId } = await request.json();
    
    const session = await auth();
    const userId = session.userId;
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!checkoutId) {
      return NextResponse.json(
        { success: false, error: 'Checkout ID is required' },
        { status: 400 }
      );
    }

    // Check if this checkout has already been processed
    const [existingCredit] = await db
      .select()
      .from(creditLedger)
      .where(
        and(
          eq(creditLedger.userId, userId),
          eq(creditLedger.ref, checkoutId)
        )
      )
      .limit(1);

    if (!existingCredit) {
      // Only add credits if this checkout hasn't been processed before
      await db.insert(creditLedger).values({
        userId,
        amount: 100, // Adjust based on your credit system
        reason: 'purchase',
        ref: checkoutId,
        metadata: { checkoutId },
        source: 'checkout',
        createdAt: new Date()
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error verifying credits:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
