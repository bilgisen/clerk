// lib/services/credits/credit-service.ts
import 'server-only';

import { eq, and, isNull, gt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/server";
import { creditLedger, activity } from "@/db/schema/credits";
import { users } from "@/db/schema";

type CreditTransaction = {
  userId: string;
  amount: number;
  reason: string;
  source?: string;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
  expiresAt?: Date;
};

// Type for the transaction
type Transaction = Parameters<typeof db.transaction>[0];

export class CreditService {
  /**
   * Award signup bonus to a new user
   * @param userId The ID of the user
   * @returns The result of the operation
   */
  async awardSignupBonus(userId: string) {
    const SIGNUP_BONUS_AMOUNT = 1000; // 1000 credits as signup bonus
    const idempotencyKey = `signup_bonus_${Date.now()}_${userId}`;

    try {
      // Check if bonus was already awarded using idempotency key
      const existing = await db.query.creditLedger.findFirst({
        where: (ledger, { and, eq }) => 
          and(
            eq(ledger.userId, userId),
            eq(ledger.reason, 'signup_bonus')
          )
      });

      if (existing) {
        console.log(`Signup bonus already awarded to user ${userId}`);
        return { 
          success: false, 
          message: 'Signup bonus already awarded',
          amount: 0
        };
      }

      await db.transaction(async (tx) => {
        // Add credit to ledger
        await tx.insert(creditLedger).values({
          userId,
          amount: SIGNUP_BONUS_AMOUNT,
          reason: 'signup_bonus',
          idempotencyKey,
          source: 'clerk',
          metadata: { 
            type: 'signup_bonus',
            awardedAt: new Date().toISOString()
          }
        });

        // Record activity
        await tx.insert(activity).values({
          userId,
          type: 'signup_bonus',
          title: 'Hoş geldin bonusu',
          delta: SIGNUP_BONUS_AMOUNT,
          ref: 'system'
        });
      });

      console.log(`Awarded ${SIGNUP_BONUS_AMOUNT} credits to user ${userId}`);
      return { 
        success: true, 
        amount: SIGNUP_BONUS_AMOUNT,
        message: 'Signup bonus awarded successfully'
      };
    } catch (error) {
      console.error('Error awarding signup bonus:', error);
      throw new Error(`Failed to award signup bonus: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the current balance of a user
   * @param userId The ID of the user
   * @returns The current credit balance
   */
  async getBalance(userId: string): Promise<number> {
    try {
      console.log(`[CreditService] Getting balance for user ${userId}`);
      
      // First, let's log all credit ledger entries for this user
      const allEntries = await db
        .select()
        .from(creditLedger)
        .where(eq(creditLedger.userId, userId));
      
      console.log(`[CreditService] Found ${allEntries.length} credit ledger entries for user ${userId}:`, allEntries);
      
      // Then run the actual balance query
      const query = db
        .select({ 
          balance: sql<number>`COALESCE(SUM(${creditLedger.amount}), 0)` 
        })
        .from(creditLedger)
        .where(
          and(
            eq(creditLedger.userId, userId),
            or(
              isNull(creditLedger.expiresAt),
              gt(creditLedger.expiresAt, new Date())
            )
          )
        );
      
      const sqlQuery = query.toSQL();
      console.log(`[CreditService] Running query:`, sqlQuery.sql);
      console.log(`[CreditService] Query params:`, sqlQuery.params);
      
      const [result] = await query;
      const balance = result?.balance ?? 0;
      
      console.log(`[CreditService] Raw result:`, result);
      console.log(`[CreditService] Calculated balance:`, balance);
      
      // Log a warning if the balance doesn't match the sum of all entries (for debugging)
      const manualSum = allEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
      if (balance !== manualSum) {
        console.warn(`[CreditService] Balance mismatch! SQL sum: ${balance}, Manual sum: ${manualSum}`);
      }
      
      return balance;
    } catch (error) {
      console.error('Error getting balance:', error);
      return 0;
    }
  }

  /**
   * Spend credits from a user's account
   * @param options Options for spending credits
   * @returns The result of the operation
   */
  async spendCredits(options: {
    userId: string;
    amount: number;
    reason: string;
    ref?: string;
    metadata?: any;
    idempotencyKey: string;
  }) {
    if (options.amount <= 0) {
      throw new Error("Amount must be positive");
    }

    return await db.transaction(async (tx) => {
      // Check for idempotency
      const exists = await tx.query.creditLedger.findFirst({
        where: (ledger, { eq }) => 
          eq(ledger.userId, options.userId) && 
          eq(ledger.idempotencyKey, options.idempotencyKey)
      });

      if (exists) {
        return { 
          ok: true, 
          balance: await this.getBalance(options.userId) 
        };
      }

      const balance = await this.getBalance(options.userId);
      if (balance < options.amount) {
        throw new Error("INSUFFICIENT_CREDITS");
      }

      // Record the spend
      await tx.insert(creditLedger).values({
        userId: options.userId,
        amount: -options.amount,
        reason: options.reason,
        ref: options.ref,
        metadata: options.metadata ?? {},
        idempotencyKey: options.idempotencyKey,
        source: "app",
      });

      // Record activity
      await tx.insert(activity).values({
        userId: options.userId,
        type: "spend",
        title: options.reason,
        delta: -options.amount,
        ref: options.ref,
      });

      const newBalance = await this.getBalance(options.userId);
      return { ok: true, balance: newBalance };
    });
  }

  /**
   * Add credits to a user's account
   * @param options Options for adding credits
   * @returns The result of the operation
   */
  async addCredits({
    userId,
    amount,
    reason,
    source = 'system',
    metadata = {},
    idempotencyKey = crypto.randomUUID(),
    expiresAt,
  }: Omit<CreditTransaction, 'idempotencyKey'> & { idempotencyKey?: string }) {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    console.log(`[CreditService] Adding ${amount} credits to user ${userId} for reason: ${reason}`);
    
    try {
      return await db.transaction(async (tx) => {
        // Check for existing transaction with same idempotency key
        const existing = await tx.query.creditLedger.findFirst({
          where: (ledger, { and, eq }) => and(
            eq(ledger.userId, userId),
            eq(ledger.idempotencyKey, idempotencyKey)
          )
        });

        if (existing) {
          console.log(`[CreditService] Transaction already processed with idempotency key: ${idempotencyKey}`);
          return { success: true, message: 'Transaction already processed', amount: 0 };
        }

        // Add to credit ledger
        console.log(`[CreditService] Adding ${amount} credits to ledger for user ${userId}`);
        const [ledgerEntry] = await tx.insert(creditLedger).values({
          userId,
          amount,
          reason,
          source,
          metadata: JSON.stringify(metadata),
          idempotencyKey,
          expiresAt,
        }).returning();

        // Add activity
        console.log(`[CreditService] Adding activity for credit addition to user ${userId}`);
        await tx.insert(activity).values({
          userId,
          type: 'credit',
          title: 'Credits Added',
          delta: amount,
          ref: reason,
        });

        console.log(`[CreditService] Successfully added ${amount} credits to user ${userId}`);
        return { success: true, amount, ledgerEntry };
      });
    } catch (error) {
      console.error('Error adding credits:', error);
      throw error;
    }
  }

  /**
   * Get recent activities for a user
   * @param userId The ID of the user
   * @param limit Maximum number of activities to return
   * @returns List of recent activities
   */
  async getRecentActivities(userId: string, limit: number = 10) {
    const result = await db.query.activity.findMany({
      where: (activity, { eq }) => eq(activity.userId, userId),
      orderBy: (activity, { desc }) => [desc(activity.createdAt)],
      limit,
    });
    return result;
  }
}

export const creditService = new CreditService();
