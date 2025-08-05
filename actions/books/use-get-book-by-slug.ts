"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import type { Book } from "@/types/book";

interface UseGetBookBySlugResult {
  book: Book | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Custom hook to fetch a book by its slug with Clerk authentication
 * @param slug - The slug of the book to fetch
 * @returns An object containing the book, loading state, error, and refresh function
 */
export function useGetBookBySlug(slug: string): UseGetBookBySlugResult {
  const { getToken } = useAuth();
  const [book, setBook] = useState<Book | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBook = async () => {
    if (!slug) {
      setError("No slug provided");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        throw new Error("Authentication required");
      }

      const response = await fetch(`/api/books/by-slug/${slug}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Book not found");
        } else if (response.status === 401 || response.status === 403) {
          throw new Error("You don't have permission to view this book");
        } else {
          throw new Error(`Failed to fetch book: ${response.statusText}`);
        }
      }

      const data = await response.json();
      setBook(data);
    } catch (err) {
      console.error("Error fetching book:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch book");
      setBook(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBook();
  }, [slug]);

  // Return refresh function to allow manual refresh
  return { 
    book, 
    isLoading, 
    error, 
    refresh: fetchBook 
  };
}
