'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChapterNode, ChapterOrderUpdate } from '@/types/dnd';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Chapter, ChapterWithChildren } from '@/types/chapter';

// Types
type CreateChapterInput = {
  title: string;
  bookId: string;
  parentChapterId?: string | null;
  order?: number;
  level?: number;
};

type UpdateChapterInput = {
  id: string;
  title?: string;
  slug?: string;
  content?: string;
  order?: number;
  level?: number;
  parentChapterId?: string | null;
};

// API functions
/**
 * @deprecated Use fetchChaptersByBookSlug instead
 */
const fetchChaptersByBook = async (bookId: string): Promise<ChapterNode[]> => {
  // This is a fallback that will be removed in the future
  // First try to get the book by ID to get its slug
  const bookResponse = await fetch(`/api/books/by-id/${bookId}`, {
    credentials: 'include',
  });
  
  if (!bookResponse.ok) {
    const error = await bookResponse.json();
    throw new Error(error.message || 'Failed to fetch book details');
  }
  
  const book = await bookResponse.json();
  
  // Now fetch chapters using the slug
  return fetchChaptersByBookSlug(book.slug);
};

const fetchChaptersByBookSlug = async (bookSlug: string): Promise<ChapterWithChildren[]> => {
  const response = await fetch(`/api/books/by-slug/${bookSlug}/chapters`, {
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch chapters by slug');
  }
  return response.json();
};

const fetchChapterBySlug = async (bookSlug: string, chapterId: string): Promise<Chapter> => {
  const response = await fetch(`/api/books/by-slug/${bookSlug}/chapters/${chapterId}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch chapter');
  }
  return response.json();
};

const createChapter = async (data: CreateChapterInput): Promise<ChapterNode> => {
  const response = await fetch(`/api/books/${data.bookId}/chapters`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create chapter');
  }
  
  return response.json();
};

const updateChapter = async ({ id, ...data }: UpdateChapterInput): Promise<ChapterNode> => {
  const response = await fetch(`/api/chapters/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update chapter');
  }
  
  return response.json();
};

const deleteChapter = async (id: string): Promise<{ success: boolean }> => {
  const response = await fetch(`/api/chapters/${id}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete chapter');
  }
  
  return { success: true };
};

const updateChapterOrder = async (updates: ChapterOrderUpdate[]): Promise<{ success: boolean }> => {
  try {
    console.log('Updating chapter order with:', updates);
    
    // Format updates to match the server's expected format
    // Note: book_id is not part of ChapterOrderUpdate, so we'll add it from the URL params
    const formattedUpdates = updates.map(update => ({
      id: update.id,
      order: update.order,
      level: update.level,
      parent_chapter_id: update.parent_chapter_id,
      // The server will add the book_id from the URL params
    }));
    
    // Wrap updates in an object with an 'updates' property to match server expectation
    const response = await fetch('/api/chapters/order', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ updates: formattedUpdates }), // Wrap in { updates: [...] }
    });
    
    let responseData;
    try {
      responseData = await response.json();
    } catch (error) {
      console.error('Failed to parse response:', error);
      throw new Error('Invalid response from server');
    }
    
    if (!response.ok) {
      console.error('Error updating chapter order:', {
        status: response.status,
        statusText: response.statusText,
        response: responseData,
        requestBody: formattedUpdates
      });
      
      throw new Error(
        responseData?.message || 
        responseData?.error || 
        `Failed to update chapter order: ${response.status} ${response.statusText}`
      );
    }
    
    console.log('Successfully updated chapter order:', responseData);
    return { success: true };
  } catch (error) {
    console.error('Exception in updateChapterOrder:', error);
    throw error; // Re-throw to be handled by the mutation
  }
};

// Hooks
// Hook to fetch all chapters for a book by ID
export const useChapters = (bookId: string) => {
  return useQuery<ChapterNode[], Error>({
    queryKey: ['chapters', bookId],
    queryFn: () => fetchChaptersByBook(bookId),
    enabled: !!bookId,
  });
};

// Hook to fetch all chapters for a book by slug
export const useChaptersBySlug = (bookSlug: string) => {
  return useQuery<ChapterWithChildren[], Error>({
    queryKey: ['chapters', bookSlug],
    queryFn: () => fetchChaptersByBookSlug(bookSlug),
    enabled: !!bookSlug,
  });
};

// Hook to fetch a single chapter by book slug and chapter ID
export const useChapter = (bookSlug: string, chapterId: string) => {
  return useQuery<Chapter, Error>({
    queryKey: ['chapter', bookSlug, chapterId],
    queryFn: () => fetchChapterBySlug(bookSlug, chapterId),
    enabled: !!bookSlug && !!chapterId,
  });
};

export function useCreateChapter(bookId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();
  
  return useMutation({
    mutationFn: createChapter,
    onSuccess: (data) => {
      // Invalidate and refetch the chapters list
      queryClient.invalidateQueries({ queryKey: ['chapters', bookId] });
      toast.success('Chapter created successfully');
      router.push(`/dashboard/books/${bookId}/chapters/${data.id}`);
    },
    onError: (error: Error) => {
      toast.error(`Error creating chapter: ${error.message}`);
    },
  });
}

export function useUpdateChapter(bookId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateChapter,
    onMutate: async (updatedChapter) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['chapters', bookId] });
      
      // Snapshot the previous value
      const previousChapters = queryClient.getQueryData<ChapterNode[]>(['chapters', bookId]);
      
      // Optimistically update to the new value
      if (previousChapters) {
        queryClient.setQueryData<ChapterNode[]>(['chapters', bookId], (old) => 
          old?.map((chapter) => 
            chapter.id === updatedChapter.id ? { ...chapter, ...updatedChapter } : chapter
          ) || []
        );
      }
      
      return { previousChapters };
    },
    onError: (err, updatedChapter, context) => {
      // Rollback on error
      if (context?.previousChapters) {
        queryClient.setQueryData(['chapters', bookId], context.previousChapters);
      }
      toast.error(`Error updating chapter: ${err.message}`);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['chapters', bookId] });
    },
  });
}

export function useDeleteChapter(bookId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteChapter,
    onMutate: async (chapterId) => {
      await queryClient.cancelQueries({ queryKey: ['chapters', bookId] });
      
      const previousChapters = queryClient.getQueryData<ChapterNode[]>(['chapters', bookId]);
      
      // Optimistically remove the chapter
      if (previousChapters) {
        queryClient.setQueryData<ChapterNode[]>(['chapters', bookId], (old) => 
          old?.filter((chapter) => chapter.id !== chapterId) || []
        );
      }
      
      return { previousChapters };
    },
    onError: (err, chapterId, context) => {
      if (context?.previousChapters) {
        queryClient.setQueryData(['chapters', bookId], context.previousChapters);
      }
      toast.error(`Error deleting chapter: ${err.message}`);
    },
    onSuccess: () => {
      toast.success('Chapter deleted successfully');
    },
  });
}

export function useUpdateChapterOrder(bookId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateChapterOrder,
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ['chapters', bookId] });
      
      const previousChapters = queryClient.getQueryData<ChapterNode[]>(['chapters', bookId]);
      
      // Optimistically update the order
      if (previousChapters) {
        const updatedChapters = [...previousChapters];
        
        updates.forEach(({ id, order, level, parent_chapter_id }) => {
          const index = updatedChapters.findIndex((ch) => ch.id === id);
          if (index !== -1) {
            updatedChapters[index] = {
              ...updatedChapters[index],
              order,
              level,
              parent_chapter_id,
            };
          }
        });
        
        queryClient.setQueryData(['chapters', bookId], updatedChapters);
      }
      
      return { previousChapters };
    },
    onError: (err, updates, context) => {
      if (context?.previousChapters) {
        queryClient.setQueryData(['chapters', bookId], context.previousChapters);
      }
      toast.error(`Error updating chapter order: ${err.message}`);
    },
  });
}
