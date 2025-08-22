import { pgTable, uuid, text, integer, timestamp, jsonb, index, uniqueIndex, AnyPgColumn } from "drizzle-orm/pg-core";
import { users } from "../schema";

export const creditLedger = pgTable("credit_ledger", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(), // +credit, -spend
  reason: text("reason").notNull(),    // signup_bonus | book_create | publish_epub | publish_pdf | publish_audio | subscription | purchase | admin_adjust
  ref: text("ref"),                    // bookId/orderId/subscriptionId etc.
  metadata: jsonb("metadata"),
  expiresAt: timestamp("expires_at"),  // optional: null if no expiration
  createdAt: timestamp("created_at").defaultNow(),
  source: text("source").notNull().default("app"), // app|clerk|polar
  idempotencyKey: text("idempotency_key"),
}, (t) => ({
  byUser: index("ledger_user_idx").on(t.userId, t.createdAt),
  idem: uniqueIndex("ledger_idem_uidx").on(t.userId, t.idempotencyKey), // for idempotency
}));

export const activity = pgTable("activity", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // book_created | published | purchased | subscription_credited | etc.
  title: text("title"),
  delta: integer("delta").notNull(), // +/-
  ref: text("ref"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  byUser: index("activity_user_idx").on(t.userId, t.createdAt),
}));

// Export types for TypeScript
export type CreditLedger = typeof creditLedger.$inferSelect;
export type NewCreditLedger = typeof creditLedger.$inferInsert;
export type Activity = typeof activity.$inferSelect;
export type NewActivity = typeof activity.$inferInsert;
