'use server';

import { db } from '@/lib/db/server';
import { creditLedger } from '@/db/schema';
import { auth } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';

export async function verifyAndUpdateCredits(checkoutId: string) {
  try {
    const session = auth();
    const userId = await session.userId;
    
    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Here you would typically verify the checkout with your payment provider
    // For now, we'll just simulate a successful verification
    const isVerified = true; // Replace with actual verification logic

    if (isVerified) {
      // Update user credits or perform other database operations
      // This is just an example - adjust according to your schema
      // First check if this checkout has already been processed
      const [existingCredit] = await db
        .select()
        .from(creditLedger)
        .where(
          and(
            eq(creditLedger.userId, userId),
            eq(creditLedger.checkoutId, checkoutId)
          )
        )
        .limit(1);

      if (!existingCredit) {
        // Only add credits if this checkout hasn't been processed before
        await db.insert(creditLedger).values({
          userId,
          amount: 100, // Adjust based on your credit system
          type: 'purchase',
          source: 'checkout',
          checkoutId,
          description: 'Credits from purchase',
          metadata: { checkoutId },
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      return { success: true };
    }

    return { success: false, error: 'Payment verification failed' };
  } catch (error) {
    console.error('Error in verifyAndUpdateCredits:', error);
    return { success: false, error: 'An error occurred while processing your request' };
  }
}
