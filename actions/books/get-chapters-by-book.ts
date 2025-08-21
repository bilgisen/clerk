// actions/books/get-chapters-by-book.ts
"use server";

import { auth } from "@clerk/nextjs/server";
import type { ChapterNode } from "@/types/dnd";

/**
 * Fetches all chapters for a specific book, building a hierarchical structure
 * @param bookId - The ID of the book to fetch chapters for
 * @returns A promise that resolves to an array of ChapterNode objects with nested children
 */
export async function getChaptersByBook(bookId: string): Promise<ChapterNode[]> {
  console.log(`[DEBUG] getChaptersByBook called with bookId: ${bookId}`);
  if (!bookId) {
    console.error('No bookId provided to getChaptersByBook');
    return [];
  }

  const session = await auth();
  const token = await session?.getToken();
  
  if (!token) {
    console.error('No authentication token found');
    return [];
  }

  try {
    // Fetch chapters from the API endpoint which handles authentication and permissions
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(
      `${baseUrl}/api/books/${bookId}/chapters`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 0 }, // Disable caching
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[ERROR] Failed to fetch chapters: ${response.status}`, errorData);
      throw new Error(errorData.message || 'Failed to fetch chapters');
    }

    const data = await response.json();
    
    // The API already returns the chapters in a tree structure
    // Just ensure we have the correct return type
    return data.tree || [];
  } catch (error) {
    console.error('[ERROR] Error in getChaptersByBook:', error);
    throw error;
  }
}
