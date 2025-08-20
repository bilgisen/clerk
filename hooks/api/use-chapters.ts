'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChapterNode, ChapterOrderUpdate } from '@/types/dnd';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
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

import { fetchWithAuth } from '@/lib/api';

// API functions
/**
 * Fetches chapters for a book by its ID
 * @param bookId The ID of the book
 * @returns Promise with the list of chapters
 */
const fetchChaptersByBook = async (bookId: string, token: string): Promise<ChapterNode[]> => {
  try {
    if (!token) {
      throw new Error('No authentication token provided');
    }
    
    const response = await fetch(`/api/books/${bookId}/chapters`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to fetch chapters');
    }
    
    return response.json();
  } catch (error) {
    console.error('Error fetching chapters:', error);
    throw error;
  }
};

/**
 * Fetches chapters for a book by its slug
 * @param bookSlug The slug of the book
 * @returns Promise with the hierarchical list of chapters
 */
const fetchChaptersByBookSlug = async (bookSlug: string, token: string): Promise<ChapterWithChildren[]> => {
  try {
    if (!token) {
      throw new Error('No authentication token provided');
    }
    
    const response = await fetch(`/api/books/by-slug/${bookSlug}/chapters`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to fetch chapters');
    }
    
    return response.json();
  } catch (error) {
    console.error('Error fetching chapters by slug:', error);
    throw error;
  }
};

/**
 * Fetches a single chapter by book slug and chapter ID
 * @param bookSlug The slug of the book
 * @param chapterId The ID of the chapter
 * @returns Promise with the chapter data
 */
const fetchChapterBySlug = async (bookSlug: string, chapterId: string): Promise<Chapter> => {
  try {
    const { getToken } = useAuth();
    const token = await getToken();
    
    if (!token) {
      throw new Error('No authentication token found');
    }
    
    const response = await fetch(`/api/books/by-slug/${bookSlug}/chapters/${chapterId}`, {
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
const createChapter = async (data: CreateChapterInput): Promise<ChapterNode> => {
  try {
    const { getToken } = useAuth();
    const token = await getToken();
    
    if (!token) {
      throw new Error('No authentication token found');
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

const updateChapter = async ({ id, ...data }: UpdateChapterInput): Promise<ChapterNode> => {
  try {
    const { getToken } = useAuth();
    const token = await getToken();
    
    if (!token) {
      throw new Error('No authentication token found');
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

const deleteChapter = async (id: string): Promise<{ success: boolean }> => {
  try {
    const { getToken } = useAuth();
    const token = await getToken();
    
    if (!token) {
      throw new Error('No authentication token found');
    }
    
    const response = await fetch(`/api/chapters/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to delete chapter');
    }
    
    return await response.json();
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
      parent_chapter_id: update.parent_chapter_id || null,
      level: update.level || 0,
    }));

    const response = await fetch(`/api/chapters/reorder`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ chapters: formattedUpdates }),
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
  
  return useQuery<ChapterNode[], Error>({
    queryKey: ['chapters', bookId],
    queryFn: async () => {
      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }
      return fetchChaptersByBook(bookId, token);
    },
    enabled: !!bookId,
  });
};

// Hook to fetch all chapters for a book by slug
export const useChaptersBySlug = (bookSlug: string) => {
  const { getToken } = useAuth();
  
  return useQuery<ChapterWithChildren[], Error>({
    queryKey: ['chapters', bookSlug],
    queryFn: async () => {
      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }
      return fetchChaptersByBookSlug(bookSlug, token);
    },
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
