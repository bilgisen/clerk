'use server';

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { books, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { notFound } from 'next/navigation';

// This is a server action that can be called from the client
export async function getBooks() {
  try {
    // Get the current user's session
    const session = await auth();
    
    if (!session?.userId) {
      console.error('[getBooks] No authenticated user found');
      // Return a simple error that can be handled by the client
      return { 
        error: 'Authentication required',
        status: 401
      };
    }
    
    const clerkUserId = session.userId;
    console.log(`[getBooks] Fetching books for Clerk user ${clerkUserId}`);

    // First, get the database user ID for this Clerk user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);

    if (!user) {
      console.error(`[getBooks] No database user found for Clerk user ${clerkUserId}`);
      notFound();
    }

    console.log(`[getBooks] Found database user ${user.id} for Clerk user ${clerkUserId}`);

    // Now fetch books using the database user ID
    const userBooks = await db
      .select()
      .from(books)
      .where(eq(books.userId, user.id))
      .orderBy(books.createdAt);

    console.log(`[getBooks] Found ${userBooks.length} books for user ${user.id}`);
    return { 
      data: userBooks,
      status: 200
    };
  } catch (error) {
    console.error('[getBooks] Error:', error);
    return { 
      error: 'Failed to fetch books',
      status: 500,
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export type GetBooksResult = Awaited<ReturnType<typeof getBooks>>;
