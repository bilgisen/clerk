"use server";

import { db } from "@/db/drizzle";
import { books, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import type { Book, BookGenre } from "@/types/book";

/**
 * Fetches a book by its slug for the current user
 * @param slug - The slug of the book to fetch
 * @returns The book if found and belongs to the current user, null otherwise
 */
export async function getBookBySlug(slug: string): Promise<Book | null> {
  try {
    if (!slug) {
      console.error('No slug provided to getBookBySlug');
      return null;
    }

    // Get the current user session
    const session = await auth();
    const userId = session?.userId;

    if (!userId) {
      console.error('No user ID in session');
      return null;
    }

    console.log(`[DEBUG] Querying database for user with Clerk ID: ${userId}`);
    // First, get the user's database ID from their Clerk ID
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);

    if (!user) {
      console.error(`[ERROR] No database user found for Clerk ID: ${userId}`);
      return null;
    }

    console.log(`[DEBUG] Querying database for book with slug: ${slug} and user ID: ${user.id}`);
    // Now query the book using the database user ID
    const [book] = await db
      .select()
      .from(books)
      .where(
        and(
          eq(books.slug, slug),
          eq(books.userId, user.id)
        )
      )
      .limit(1);
    
    console.log(`[DEBUG] Database query result:`, book ? 'Book found' : 'No book found');

    if (!book) {
      console.log(`Book not found with slug: ${slug} for user: ${userId}`);
      return null;
    }

    // Map database fields to Book type
    return {
      id: book.id,
      userId: book.userId,
      title: book.title,
      slug: book.slug,
      author: book.author,
      subtitle: book.subtitle || null,
      description: book.description || null,
      publisher: book.publisher || null,
      publisherWebsite: book.publisherWebsite || null,
      publishYear: book.publishYear || null,
      isbn: book.isbn || null,
      language: book.language || 'tr',
      genre: book.genre as BookGenre || null,
      series: book.series || null,
      seriesIndex: book.seriesIndex || null,
      tags: book.tags || null,
      coverImageUrl: book.coverImageUrl || null,
      isPublished: book.isPublished || false,
      isFeatured: book.isFeatured || false,
      createdAt: book.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: book.updatedAt?.toISOString() || new Date().toISOString(),
    } as Book;
  } catch (error) {
    console.error('Error fetching book by slug:', error);
    return null;
  }
}
