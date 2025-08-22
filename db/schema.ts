import { pgEnum, pgTable, text, timestamp, uuid, integer, boolean, jsonb, AnyPgColumn } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { creditLedger, activity } from './schema/credits';

// Enums
export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'MEMBER', 'AUTHOR', 'PUBLISHER', 'ULTIMATE']);
export const subscriptionStatusEnum = pgEnum('subscription_status', ['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'INCOMPLETE_EXPIRED', 'UNPAID', 'PAUSED']);

// Users Table
export const users = pgTable('users', {
  // Clerk Authentication
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: text('clerk_id').unique().notNull(),

  // Basic Info
  email: text('email').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  imageUrl: text('image_url'),

  // Role & Permissions
  role: userRoleEnum('role').default('MEMBER').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  permissions: text('permissions').array().default(['read:books']).notNull(),

  // Subscription (Polar.sh)
  subscriptionId: text('subscription_id').unique(),
  subscriptionStatus: subscriptionStatusEnum('subscription_status').default('TRIAL'),
  subscriptionPlan: text('subscription_plan'),
  subscriptionStartDate: timestamp('subscription_start_date'),
  subscriptionEndDate: timestamp('subscription_end_date'),
  polarCustomerId: text('polar_customer_id').unique(),

  // Metadata
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at'),
}, (table) => ({
  emailIdx: { columns: [table.email] },
  roleIdx: { columns: [table.role] },
  subscriptionStatusIdx: { columns: [table.subscriptionStatus] },
  subscriptionPlanIdx: { columns: [table.subscriptionPlan] },
  lastLoginIdx: { columns: [table.lastLoginAt] },
}));

// Subscription Plans (Polar-linked)
export const subscriptionPlans = pgTable('subscription_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  monthlyCreditQuota: integer('monthly_credit_quota').notNull(),
  priceMonthly: integer('price_monthly').notNull(),
  priceYearly: integer('price_yearly'),
  features: text('features').array().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nameIdx: { columns: [table.name] },
  isActiveIdx: { columns: [table.isActive] },
}));

// User Preferences
export const userPreferences = pgTable('user_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  language: text('language').default('tr'),
  theme: text('theme').default('light'),
  notifications: jsonb('notifications').default({
    email: true,
    push: true,
    newsletter: true,
  }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: { columns: [table.userId] },
}));

// Book Genre Enum
export const bookGenreEnum = pgEnum('book_genre', [
  'FICTION', 'NON_FICTION', 'SCIENCE_FICTION', 'FANTASY', 'ROMANCE',
  'THRILLER', 'MYSTERY', 'HORROR', 'BIOGRAPHY', 'HISTORY', 'SELF_HELP',
  'CHILDREN', 'YOUNG_ADULT', 'COOKBOOK', 'TRAVEL', 'HUMOR', 'POETRY',
  'BUSINESS', 'TECHNOLOGY', 'SCIENCE', 'PHILOSOPHY', 'RELIGION', 'OTHER'
]);

// Books Table
export const books = pgTable('books', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Core Information
  title: text('title').notNull(),
  subtitle: text('subtitle'),
  slug: text('slug').notNull().unique(),

  // Author Information
  author: text('author').notNull(),
  contributor: text('contributor'),
  translator: text('translator'),

  // Publication Details
  publisher: text('publisher'),
  publisherWebsite: text('publisher_website'),
  publishYear: integer('publish_year'),
  isbn: text('isbn'),

  // Classification
  genre: bookGenreEnum('genre'),
  series: text('series'),
  seriesIndex: integer('series_index'),
  tags: text('tags').array(),

  // Content
  description: text('description'),
  language: text('language').default('tr'),

  // Media
  coverImageUrl: text('cover_image_url'),
  epubUrl: text('epub_url'),

  // Metadata
  isPublished: boolean('is_published').default(false).notNull(),
  isFeatured: boolean('is_featured').default(false).notNull(),
  viewCount: integer('view_count').default(0).notNull(),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
}, (table) => ({
  userIdIdx: { columns: [table.userId] },
  slugIdx: { columns: [table.slug] },
  authorIdx: { columns: [table.author] },
  genreIdx: { columns: [table.genre] },
  publishedIdx: { columns: [table.isPublished, table.publishedAt] },
  seriesIdx: { columns: [table.series] },
  tagsIdx: { columns: [table.tags], using: 'gin' },
}));

// Media Table
export const media = pgTable('media', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  bookId: uuid('book_id').references(() => books.id, { onDelete: 'cascade' }),

  // File Information
  url: text('url').notNull(),
  name: text('name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  width: integer('width'),
  height: integer('height'),

  // Metadata
  altText: text('alt_text'),
  caption: text('caption'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: { columns: [table.userId] },
  bookIdIdx: { columns: [table.bookId] },
  mimeTypeIdx: { columns: [table.mimeType] },
  urlIdx: { columns: [table.url] },
}));

// Chapters Table
export const chapters = pgTable('chapters', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookId: uuid('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),

  // Hierarchy
  parentChapterId: uuid('parent_chapter_id').references((): AnyPgColumn => {
    return chapters.id as unknown as AnyPgColumn;
  }, { onDelete: 'set null' }),

  // Content
  title: text('title').notNull(),
  content: jsonb('content').notNull(),
  excerpt: text('excerpt'),

  // Organization
  order: integer('order').default(0).notNull(),
  level: integer('level').default(1).notNull(),
  isDraft: boolean('is_draft').default(false).notNull(),

  // Metadata
  wordCount: integer('word_count').default(0).notNull(),
  readingTime: integer('reading_time'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
}, (table) => ({
  bookIdIdx: { columns: [table.bookId] },
  parentChapterIdIdx: { columns: [table.parentChapterId] },
  bookOrderIdx: { columns: [table.bookId, table.order] },
  isDraftIdx: { columns: [table.isDraft] },
  createdAtIdx: { columns: [table.createdAt] },
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  books: many(books),
  media: many(media),
  preferences: many(userPreferences),
}));

export const booksRelations = relations(books, ({ one, many }) => ({
  user: one(users, {
    fields: [books.userId],
    references: [users.id],
  }),
  coverImage: one(media, {
    fields: [books.coverImageUrl],
    references: [media.url],
  }),
  chapters: many(chapters),
  media: many(media),
}));

export const chaptersRelations = relations(chapters, ({ one, many }) => ({
  book: one(books, {
    fields: [chapters.bookId],
    references: [books.id],
  }),
  parentChapter: one(chapters, {
    fields: [chapters.parentChapterId],
    references: [chapters.id],
    relationName: 'parentChapter',
  }),
  childChapters: many(chapters, {
    relationName: 'parentChapter',
  }),
}));

// Credit Ledger Relations
export const creditLedgerRelations = relations(creditLedger, ({ one }) => ({
  user: one(users, {
    fields: [creditLedger.userId],
    references: [users.id],
  }),
}));

// Activity Relations
export const activityRelations = relations(activity, ({ one }) => ({
  user: one(users, {
    fields: [activity.userId],
    references: [users.id],
  }),
}));

export const mediaRelations = relations(media, ({ one }) => ({
  user: one(users, {
    fields: [media.userId],
    references: [users.id],
  }),
  book: one(books, {
    fields: [media.bookId],
    references: [books.id],
  }),
}));

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type NewUserPreferences = typeof userPreferences.$inferInsert;
export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;
export type Chapter = typeof chapters.$inferSelect;
export type NewChapter = typeof chapters.$inferInsert;
export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;

export { creditLedger, activity } from './schema/credits';
export type { CreditLedger, NewCreditLedger } from './schema/credits';
export type { Activity, NewActivity } from './schema/credits';
