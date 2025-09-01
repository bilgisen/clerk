// lib/auth/schema.ts
import { users } from '@/db/schema';
import { sessions, verificationTokens } from '@/db/schema/auth';

export const authSchema = {
  users,
  sessions,
  verificationTokens,
} as const;

export type AuthSchema = typeof authSchema;
