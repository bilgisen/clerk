"use server";

import { db } from "@/db/drizzle";
import { books } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import type { Book } from "@/types/book";

/**
 * Fetches a book by its ID for the current user
 * @param id - The ID of the book to fetch
 * @returns The book if found and belongs to the current user, null otherwise
 */
export async function getBook(id: string): Promise<Book | null> {
  try {
    if (!id) {
      console.error('No ID provided to getBook');
      return null;
    }

    // Get the current user session
    const session = await auth();
    const userId = session?.userId;

    if (!userId) {
      console.error('No user ID in session');
      return null;
    }

    const [book] = await db
      .select()
      .from(books)
      .where(
        and(
          eq(books.id, id),
          eq(books.userId, userId)
        )
      )
      .limit(1);

    if (!book) {
      console.log(`Book not found with ID: ${id} for user: ${userId}`);
      return null;
    }

    // Map database fields to Book type
    return {
      ...book,
      // Map fields to match Book type
      user_id: book.userId,
      created_at: book.createdAt?.toISOString() || new Date().toISOString(),
      updated_at: book.updatedAt?.toISOString() || new Date().toISOString(),
      // Map snake_case to camelCase where needed
      publishYear: book.publishYear || null,
      coverImageUrl: book.coverImageUrl || null,
      // Ensure all fields that could be null in the DB are properly typed
      description: book.description || null,
      isbn: book.isbn || null,
      language: book.language || null,
    } as unknown as Book; // Double assertion to handle type differences
  } catch (error) {
    console.error('Error fetching book by ID:', error);
    return null;
  }
}
