'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChapterNode, ChapterOrderUpdate } from '@/types/dnd';
import toast from "sonner";
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
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
 * Fetches chapters for a book by its ID
 * @param bookId The ID of the book
 * @returns Promise with the list of chapters
 */
const fetchChaptersByBook = async (bookId: string, getToken: () => Promise<string | null>): Promise<ChapterNode[]> => {
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  
  const response = await fetch(`/api/books/${bookId}/chapters`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch chapters');
  }
  
  return response.json();
};

/**
 * Fetches chapters for a book by its slug
 * @param bookSlug The slug of the book
 * @returns Promise with the hierarchical list of chapters
 */
const fetchChaptersByBookSlug = async (bookSlug: string, getToken: () => Promise<string | null>): Promise<Chapter[]> => {
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  
  const response = await fetch(`/api/books/by-slug/${bookSlug}/chapters`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const errorMessage = error.message || 'Failed to fetch chapters by slug';
    throw new Error(errorMessage);
  }
  
  const data = await response.json();
  return Array.isArray(data) ? data : [];
};

/**
 * Fetches a single chapter by book slug and chapter ID
 * @param bookSlug The slug of the book
 * @param chapterId The ID of the chapter
 * @returns Promise with the chapter data
 */
const fetchChapterBySlug = async (bookSlug: string, chapterId: string, getToken: () => Promise<string | null>): Promise<Chapter> => {
  try {
    const token = await getToken();
    
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const response = await fetch(`/api/chapters/${chapterId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to fetch chapter');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching chapter:', error);
    throw error;
  }
};

/**
 * Creates a new chapter
 * @param data The chapter data to create
 * @returns Promise with the created chapter
 */
const createChapter = async (data: CreateChapterInput, getToken: () => Promise<string | null>): Promise<ChapterNode> => {
  try {
    const token = await getToken();
    
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const response = await fetch(`/api/books/${data.bookId}/chapters`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to create chapter');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating chapter:', error);
    throw error;
  }
};

const updateChapter = async ({ id, ...data }: UpdateChapterInput, getToken: () => Promise<string | null>): Promise<ChapterNode> => {
  try {
    const token = await getToken();
    
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const response = await fetch(`/api/chapters/${id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to update chapter');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating chapter:', error);
    throw error;
  }
};

const deleteChapter = async (id: string, getToken: () => Promise<string | null>): Promise<{ success: boolean }> => {
  try {
    const token = await getToken();
    
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const response = await fetch(`/api/chapters/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete chapter');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting chapter:', error);
    throw error;
  }
};

interface UpdateChapterOrderParams {
  updates: ChapterOrderUpdate[];
  token: string;
}

const updateChapterOrder = async ({ updates, token }: UpdateChapterOrderParams): Promise<{ success: boolean }> => {
  try {
    if (!token) {
      throw new Error('No authentication token provided');
    }
    
    console.log('Updating chapter order with:', updates);
    
    const formattedUpdates = updates.map(update => ({
      id: update.id,
      order: update.order,
      level: update.level,
      parentChapterId: update.parent_chapter_id || null,
    }));

    // Get the bookId from the first update (all updates should be for the same book)
    const bookId = updates[0]?.bookId;
    if (!bookId) {
      throw new Error('No bookId provided in updates');
    }

    const response = await fetch(`/api/chapters/reorder`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bookId,
        patches: formattedUpdates
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const errorMessage = error.message || 
                         error.error || 
                         `Failed to update chapter order: ${response.status} ${response.statusText}`;
      console.error('Failed to update chapter order:', errorMessage);
      throw new Error(errorMessage);
    }
    
    const responseData = await response.json();
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
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  
  return useQuery<ChapterNode[], Error>({
    queryKey: ['chapters', bookId],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return fetchChaptersByBook(bookId, getToken);
    },
    enabled: !!bookId,
    retry: 1,
  });
};

// Hook to fetch all chapters for a book by slug
export function useChaptersBySlug(
  bookSlug: string | undefined, 
  options?: { enabled?: boolean }
) {
  const { getToken } = useAuth();
  
  return useQuery<Chapter[], Error>({
    queryKey: ['chapters', bookSlug],
    queryFn: async () => {
      if (!bookSlug) {
        throw new Error('Book slug is required');
      }
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return fetchChaptersByBookSlug(bookSlug, getToken);
    },
    enabled: options?.enabled !== false && !!bookSlug,
  });
};

// Hook to fetch a single chapter by book slug and chapter ID
export function useChapter(
  bookSlug: string | undefined, 
  chapterId: string | undefined, 
  options?: { enabled?: boolean }
) {
  const { getToken } = useAuth();
  
  return useQuery<Chapter, Error>({
    queryKey: ['chapter', bookSlug, chapterId],
    queryFn: async () => {
      if (!bookSlug || !chapterId) {
        throw new Error('Book slug and chapter ID are required');
      }
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return fetchChapterBySlug(bookSlug, chapterId, getToken);
    },
    enabled: options?.enabled !== false && !!bookSlug && !!chapterId,
  });
};

export const useCreateChapter = (bookId: string) => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { getToken } = useAuth();
  
  return useMutation({
    mutationFn: async (data: CreateChapterInput) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return createChapter(data, getToken);
    },
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

export const useUpdateChapter = (bookId: string) => {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  
  return useMutation<ChapterNode, Error, UpdateChapterInput, { previousChapters: ChapterNode[] | undefined }>({
    mutationFn: async (data: UpdateChapterInput) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return updateChapter(data, getToken);
    },
    onMutate: async (newChapter: UpdateChapterInput) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['chapters', bookId] });
      
      // Snapshot the previous value
      const previousChapters = queryClient.getQueryData<ChapterNode[]>(['chapters', bookId]);
      
      // Optimistically update to the new value
      queryClient.setQueryData<ChapterNode[]>(['chapters', bookId], (old) =>
        old?.map((chapter) =>
          chapter.id === newChapter.id ? { ...chapter, ...newChapter } : chapter
        )
      );
      
      // Return a context object with the snapshotted value
      return { previousChapters };
    },
    onError: (error: Error, variables: UpdateChapterInput, context?: { previousChapters: ChapterNode[] | undefined }) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousChapters) {
        queryClient.setQueryData(['chapters', bookId], context.previousChapters);
      }
      toast.error(`Failed to update chapter: ${error.message}`);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['chapters', bookId] });
    },
  });
}

export function useDeleteChapter(bookId: string) {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  
  return useMutation<{ success: boolean }, Error, string, { previousChapters: ChapterNode[] | undefined }>({
    mutationFn: async (id: string) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return deleteChapter(id, getToken);
    },
    onMutate: async (chapterId: string) => {
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
    onError: (error: Error, chapterId: string, context?: { previousChapters: ChapterNode[] | undefined }) => {
      if (context?.previousChapters) {
        queryClient.setQueryData(['chapters', bookId], context.previousChapters);
      }
      toast.error(`Error deleting chapter: ${error.message}`);
    },
    onSuccess: () => {
      toast.success('Chapter deleted successfully');
    },
  });
}

export function useUpdateChapterOrder(bookId: string) {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  
  return useMutation({
    mutationFn: async (updates: ChapterOrderUpdate[]) => {
      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }
      return updateChapterOrder({ updates, token });
    },
    onMutate: async (updates: ChapterOrderUpdate[]) => {
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
