// lib/auth/auth-types.ts

import type { User as DbUser } from '@/db/schema';

// Base types
export type AuthError = Error & { code?: string; status?: number };

export interface AuthResponse<T = any> {
  data: T | null;
  error: AuthError | null;
  status: number;
}

// Update User interface
// Explicitly define imageUrl to be string | null, matching the likely type from DbUser after Omit
export interface User extends Omit<
  DbUser,
  'passwordHash' | 'salt' | 'verificationToken' | 'resetToken' | 'resetTokenExpires' | 'permissions' | 'emailVerified' | 'firstName' | 'lastName' | 'name' | 'image' | 'role'
> {
  // Make sure imageUrl type matches the base type after Omit
  // If the base allows undefined, you might need to adjust the base or explicitly handle it.
  // Assuming the base type after Omit expects string | null:
  imageUrl: string | null; // Remove '?' if it should always exist (even if null), or ensure types align correctly.
  roles?: string[];
  permissions?: string[];
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  emailVerified?: Date | null;
  // If 'image' exists in DbUser and is omitted, and you want it back with a potentially different type:
  image?: string | null; // Add this if needed and omitted.
  role?: string | null;
}

export interface ExtendedUser extends User {
  provider?: string;
  providerAccountId?: string;
}
