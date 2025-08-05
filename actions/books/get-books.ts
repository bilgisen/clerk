'use server';

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { books } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ensureUserInDatabase } from '@/lib/auth-utils';

export async function getBooks() {
  try {
    // Ensure the user exists in our database and get their ID
    let userId;
    try {
      const result = await ensureUserInDatabase();
      if (!result?.userId) {
        console.error('Failed to get or create user in database');
        return { error: 'Failed to authenticate user. Please try signing in again.' };
      }
      userId = result.userId;
    } catch (error) {
      console.error('Authentication error in getBooks:', error);
      return { 
        error: 'Authentication error',
        details: error instanceof Error ? error.message : 'Unknown error during authentication'
      };
    }

    // Then fetch all books for the current user
    const userBooks = await db
      .select()
      .from(books)
      .where(eq(books.userId, userId))
      .orderBy(books.createdAt);

    return { data: userBooks };
  } catch (error) {
    console.error('Error fetching books:', error);
    return { 
      error: 'Failed to fetch books',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export type GetBooksResult = Awaited<ReturnType<typeof getBooks>>;
