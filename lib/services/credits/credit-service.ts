import { eq, and, isNull, gt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/server";
import { creditLedger, activity } from "@/db/schema/credits";

// Type for the transaction
type Transaction = Parameters<typeof db.transaction>[0];

export class CreditService {
  /**
   * Get the current balance of a user
   * @param userId The ID of the user
   * @returns The current credit balance
   */
  async getBalance(userId: string): Promise<number> {
    const [row] = await db
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
    
    return row?.balance ?? 0;
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
  async addCredits(options: {
    userId: string;
    amount: number;
    reason: string;
    ref?: string;
    expiresAt?: Date | null;
    source?: 'app' | 'polar' | 'clerk';
    idempotencyKey: string;
    metadata?: any;
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

      // Add credits
      await tx.insert(creditLedger).values({
        userId: options.userId,
        amount: options.amount,
        reason: options.reason,
        ref: options.ref,
        metadata: options.metadata ?? {},
        expiresAt: options.expiresAt ?? null,
        idempotencyKey: options.idempotencyKey,
        source: options.source ?? "app",
      });

      // Record activity
      await tx.insert(activity).values({
        userId: options.userId,
        type: "credit",
        title: options.reason,
        delta: options.amount,
        ref: options.ref,
      });

      const newBalance = await this.getBalance(options.userId);
      return { ok: true, balance: newBalance };
    });
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
