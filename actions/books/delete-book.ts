"use server";

import { db } from "@/db/drizzle";
import { books, chapters } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { creditService } from "@/lib/services/credits/credit-service";
import { revalidatePath } from "next/cache";
/**
 * Checks if a string is a valid UUID
 * @param str - The string to check
 * @returns boolean indicating if the string is a valid UUID
 */
const isUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

/**
 * Deletes a book by its ID or slug
 * @param identifier - The ID or slug of the book to delete
 * @returns Object with success status and optional error message
 */
export const deleteBook = async (identifier: string) => {
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
    
    if (!identifier) {
      return { 
        success: false, 
        error: "Book identifier (ID or slug) is required" 
      };
    }

    // First verify the book exists and belongs to the current user
    const bookQuery = isUUID(identifier)
      ? db
          .select()
          .from(books)
          .where(and(
            eq(books.id, identifier),
            eq(books.userId, userId)
          ))
      : db
          .select()
          .from(books)
          .where(and(
            eq(books.slug, identifier),
            eq(books.userId, userId)
          ));

    const [book] = await bookQuery.limit(1);
      
    if (!book) {
      return { 
        success: false, 
        error: "Book not found or you don't have permission to delete it" 
      };
    }
    
    // Start a transaction to ensure all operations succeed or fail together
    try {
      await db.transaction(async (tx) => {
        // First delete all chapters associated with the book
        await tx
          .delete(chapters)
          .where(eq(chapters.bookId, book.id));
          
        // Then delete the book
        await tx
          .delete(books)
          .where(eq(books.id, book.id));
        
        // Refund credits for book creation (300 credits)
        await creditService.addCredits({
          userId,
          amount: 300,
          reason: 'book_deletion_refund',
          source: 'system',
          metadata: {
            bookId: book.id,
            refundReason: 'book_deletion'
          }
        });
      });
      
      // Revalidate the books page to update the UI
      revalidatePath('/dashboard/books');
      
      return { 
        success: true 
      };
    } catch (error) {
      console.error('Transaction error during book deletion:', error);
      throw error; // This will be caught by the outer catch block
    }
  } catch (error) {
    console.error('Error deleting book:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete book' 
    };
  }
};