'use server';

import { db } from './server';
import { and, eq } from 'drizzle-orm';
import { credits } from '@/db/schema';

export async function getUserCredits(userId: string) {
  try {
    const userCredits = await db
      .select()
      .from(credits)
      .where(eq(credits.userId, userId))
      .limit(1);

    return userCredits[0] || null;
  } catch (error) {
    console.error('Error fetching user credits:', error);
    return null;
  }
}
