"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

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

    // Call the API to delete the book
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/books/by-id/${bookId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      return { 
        success: false, 
        error: error.error || 'Failed to delete book' 
      };
    }
    
    // Revalidate the books page to update the UI
    revalidatePath('/dashboard/books');
    
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