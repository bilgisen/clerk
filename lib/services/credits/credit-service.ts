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
    const SIGNUP_BONUS_AMOUNT = 100; // Adjust the bonus amount as needed
    const idempotencyKey = `signup_bonus_${userId}`;

    // Check if bonus was already awarded
    const existing = await db.query.creditLedger.findFirst({
      where: (ledger, { and, eq }) => 
        and(
          eq(ledger.userId, userId),
          eq(ledger.reason, 'signup_bonus'),
          eq(ledger.idempotencyKey, idempotencyKey)
        )
    });

    if (existing) {
      return { success: false, message: 'Signup bonus already awarded' };
    }

    await db.transaction(async (tx) => {
      // Add credit to ledger
      await tx.insert(creditLedger).values({
        userId,
        amount: SIGNUP_BONUS_AMOUNT,
        reason: 'signup_bonus',
        idempotencyKey,
        source: 'clerk',
        metadata: { type: 'signup_bonus' }
      });

      // Record activity
      await tx.insert(activity).values({
        userId,
        type: 'signup_bonus',
        title: 'Hoş geldin bonusu',
        delta: SIGNUP_BONUS_AMOUNT,
        ref: 'system',
      });
    });

    return { success: true, amount: SIGNUP_BONUS_AMOUNT };
  }

  /**
   * Get the current balance of a user
   * @param userId The ID of the user
   * @returns The current credit balance
   */
  async getBalance(userId: string): Promise<number> {
    try {
      const [result] = await db
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
      
      return result?.balance ?? 0;
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
      throw new Error('Amount must be greater than 0');
    }

    // Check for existing transaction with same idempotency key
    const existing = await db.query.creditLedger.findFirst({
      where: (ledger, { eq }) => eq(ledger.idempotencyKey, idempotencyKey),
    });

    if (existing) {
      console.log('Skipping duplicate transaction with idempotency key:', idempotencyKey);
      return { success: true, balance: await this.getBalance(userId) };
    }

    try {
      await db.transaction(async (tx) => {
        // Add to credit ledger
        await tx.insert(creditLedger).values({
          userId,
          amount,
          reason,
          source,
          idempotencyKey,
          expiresAt,
          metadata: metadata ? JSON.stringify(metadata) : null,
        });

        // Record activity
        await tx.insert(activity).values({
          userId,
          type: 'credit_added',
          title: `${reason} (${source})`,
          delta: amount,
          ref: 'system',
        });
      });

      const balance = await this.getBalance(userId);
      return { success: true, balance };
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
