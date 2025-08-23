"use server";

import { db } from "@/db/drizzle";
import { books } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { creditService } from "@/lib/services/credits/credit-service";

/**
 * Deletes a book by its ID
 * @param bookId - The ID of the book to delete
 * @returns Object with success status and optional error message
 */
export const deleteBook = async (bookId: string) => {
  try {
    // Get the current user session
    const session = await auth();
    const userId = session?.userId;
    
    if (!userId) {
      return { 
        success: false, 
        error: "You must be signed in to delete a book" 
      };
    }
    
    if (!bookId) {
      return { 
        success: false, 
        error: "Book ID is required" 
      };
    }

    // First verify the book belongs to the current user
    const [book] = await db
      .select()
      .from(books)
      .where(and(
        eq(books.id, bookId),
        eq(books.userId, userId)
      ))
      .limit(1);
      
    if (!book) {
      return { 
        success: false, 
        error: "Book not found or you don't have permission to delete it" 
      };
    }
    
    // Start a transaction to ensure both operations succeed or fail together
    await db.transaction(async (tx) => {
      // First delete the book
      await tx
        .delete(books)
        .where(eq(books.id, bookId));
      
      // Refund credits for book creation (300 credits)
      await creditService.addCredits({
        userId,
        amount: 300,
        reason: 'book_deletion_refund',
        source: 'system',
        metadata: {
          bookId,
          refundReason: 'book_deletion'
        }
      });
    });
      
    return { 
      success: true 
    };
  } catch (error) {
    console.error('Error deleting book:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete book' 
    };
  }
};