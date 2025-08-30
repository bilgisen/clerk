'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Book } from '@/types/book';

// Types for the API responses
type ApiResponse<T> = {
  data: T;
  error?: string;
  message?: string;
};

type BookResponse = ApiResponse<Book>;
type BooksResponse = ApiResponse<Book[]>;

const API_BASE_URL = '/api/books';

// Fetch all books for the current user
export function useBooks() {
  return useQuery<Book[]>({
    queryKey: ['books'],
    queryFn: async (): Promise<Book[]> => {
      const response = await fetch(API_BASE_URL);
      if (!response.ok) {
        let errorMessage = 'Failed to fetch books';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
          // Create an error with status code
          const error = new Error(errorMessage) as any;
          error.status = response.status;
          throw error;
        } catch (e) {
          const error = new Error(errorMessage) as any;
          error.status = response.status;
          throw error;
        }
      }
      const result = await response.json();
      // Handle both direct array response and { data: [] } format
      return Array.isArray(result) ? result : result.data || [];
    },
    // Don't retry on 401 Unauthorized
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('401')) {
        return false;
      }
      return failureCount < 3; // Retry up to 3 times for other errors
    },
  });
}

// Fetch a single book by slug or ID
export function useBook(identifier: string, options?: { enabled?: boolean; bySlug?: boolean }) {
  return useQuery<Book>({
    queryKey: ['books', identifier],
    queryFn: async (): Promise<Book> => {
      // If bySlug is true, use the slug endpoint, otherwise use the ID endpoint
      const endpoint = options?.bySlug 
        ? `${API_BASE_URL}/slug/${identifier}`
        : `${API_BASE_URL}/${identifier}`;
        
      const response = await fetch(endpoint);
      if (!response.ok) {
        const error: ApiResponse<null> = await response.json();
        throw new Error(error.message || 'Failed to fetch book');
      }
      const result: BookResponse = await response.json();
      return result.data;
    },
    enabled: options?.enabled !== false && !!identifier,
    ...options,
  });
}

// Types for mutations
export interface CreateBookInput {
  title: string;
  description?: string;
  // Add other book fields as needed
}

export interface UpdateBookInput extends Partial<CreateBookInput> {
  id: string;
}

// Helper function for common fetch options
const getFetchOptions = (method: string, data?: unknown) => ({
  method,
  headers: {
    'Content-Type': 'application/json',
  },
  body: data ? JSON.stringify(data) : undefined,
});

// Create a new book
export function useCreateBook() {
  const queryClient = useQueryClient();
  
  return useMutation<BookResponse, Error, CreateBookInput>({
    mutationFn: async (data: CreateBookInput): Promise<BookResponse> => {
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error: ApiResponse<null> = await response.json();
        throw new Error(error.message || 'Failed to create book');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch the books query to update the list
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
  });
}

// Update an existing book
export function useUpdateBook() {
  const queryClient = useQueryClient();
  
  return useMutation<BookResponse, Error, UpdateBookInput>({
    mutationFn: async ({ id, ...updates }: UpdateBookInput): Promise<BookResponse> => {
      const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        const error: ApiResponse<null> = await response.json();
        throw new Error(error.message || 'Failed to update book');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate both the specific book and the books list
      queryClient.invalidateQueries({ queryKey: ['books', data.data.id] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
  });
}

// Delete a book
export function useDeleteBook() {
  const queryClient = useQueryClient();
  
  return useMutation<BookResponse, Error, string>({
    mutationFn: async (id: string): Promise<BookResponse> => {
      const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error: ApiResponse<null> = await response.json();
        throw new Error(error.message || 'Failed to delete book');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate the books list
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
  });
}

// Optimistically update the cache for instant UI updates
export function useOptimisticBookUpdate() {
  const queryClient = useQueryClient();
  
  return useMutation<BookResponse, Error, UpdateBookInput>({
    mutationFn: async ({ id, ...updates }: UpdateBookInput): Promise<BookResponse> => {
      const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        const error: ApiResponse<null> = await response.json();
        throw new Error(error.message || 'Failed to update book');
      }
      
      return response.json();
    },
    onMutate: async (newBook: UpdateBookInput) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['books', newBook.id] });
      
      // Snapshot the previous value
      const previousBook = queryClient.getQueryData<Book>(['books', newBook.id]);
      const previousBooks = queryClient.getQueryData<Book[]>(['books']);
      
      // Optimistically update to the new value
      if (previousBook) {
        queryClient.setQueryData(['books', newBook.id], { ...previousBook, ...newBook });
      }
      
      if (previousBooks) {
        queryClient.setQueryData(['books'], 
          previousBooks.map(book => 
            book.id === newBook.id ? { ...book, ...newBook } : book
          )
        );
      }
      
      // Return a context object with the snapshotted value
      return { previousBook, previousBooks };
    },
    // If the mutation fails, use the context returned from onMutate to roll back
    onError: (err: Error, newBook: UpdateBookInput, context: unknown) => {
      const typedContext = context as { previousBook?: Book; previousBooks?: Book[] } | undefined;
      if (typedContext?.previousBook) {
        queryClient.setQueryData(['books', newBook.id], typedContext.previousBook);
      }
      if (typedContext?.previousBooks) {
        queryClient.setQueryData(['books'], typedContext.previousBooks);
      }
    },
    // Always refetch after error or success:
    onSettled: (data) => {
      if (data?.data?.id) {
        queryClient.invalidateQueries({ queryKey: ['books', data.data.id] });
        queryClient.invalidateQueries({ queryKey: ['books'] });
      }
    },
  });
}
