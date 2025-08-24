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
      let errorMessage = 'Failed to delete book';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) {
        // If we can't parse the error response, use the status text
        errorMessage = response.statusText || errorMessage;
      }
      return { 
        success: false, 
        error: errorMessage
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