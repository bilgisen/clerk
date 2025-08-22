import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db/server';
import { creditLedger, activity } from '@/db/schema/credits';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { CreditService } from '@/lib/services/credits/credit-service';
import { v4 as uuidv4 } from 'uuid';

export async function POST() {
  try {
    const { userId: clerkUserId } = auth();
    
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }
    
    // Get the internal user ID from the database
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
      
    if (!dbUser) {
      return NextResponse.json(
        { 
          error: 'User not found in database',
          details: 'Your Clerk account exists but no corresponding user record was found.'
        },
        { status: 404 }
      );
    }
    
    const userId = dbUser.id;

    const creditService = new CreditService();
    const results: any = {};

    // Test 1: Get initial balance
    results.initialBalance = await creditService.getBalance(userId);

    // Test 2: Add 100 credits
    const addIdempotencyKey = `test_credit_${uuidv4()}`;
    try {
      const addResult = await creditService.addCredits({
        userId,
        amount: 100,
        reason: 'test_credit',
        idempotencyKey: addIdempotencyKey,
        metadata: { 
          test: true,
          source: 'test',
        },
      });
      results.addResult = addResult;
    } catch (error) {
      console.error('Error adding credits:', error);
      results.addError = error instanceof Error ? error.message : 'Failed to add credits';
      throw error;
    }

    // Test 3: Verify balance after adding credits
    results.balanceAfterAdd = await creditService.getBalance(userId);

    // Test 4: Spend 30 credits
    const spendIdempotencyKey = `test_spend_${uuidv4()}`;
    try {
      const spendResult = await creditService.spendCredits({
        userId,
        amount: 30,
        reason: 'test_spend',
        idempotencyKey: spendIdempotencyKey,
        metadata: { 
          test: true,
          source: 'test',
        },
      });
      results.spendResult = spendResult;
    } catch (error) {
      console.error('Error spending credits:', error);
      results.spendError = error instanceof Error ? error.message : 'Failed to spend credits';
      throw error;
    }

    // Test 5: Verify balance after spending credits
    results.balanceAfterSpend = await creditService.getBalance(userId);

    // Test 6: Get ledger entries
    results.ledgerEntries = await db
      .select()
      .from(creditLedger)
      .where(eq(creditLedger.userId, userId))
      .orderBy(creditLedger.createdAt);

    // Test 7: Get activity log
    results.activities = await db
      .select()
      .from(activity)
      .where(eq(activity.userId, userId))
      .orderBy(activity.createdAt);

    // Cleanup test data
    await db.delete(creditLedger).where(eq(creditLedger.userId, userId));
    await db.delete(activity).where(eq(activity.userId, userId));

    return NextResponse.json({
      success: true,
      userId,
      ...results,
    });

  } catch (error) {
    console.error('Test credits error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
