'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChapterNode, ChapterOrderUpdate } from '@/types/dnd';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

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
const fetchChaptersByBook = async (bookId: string): Promise<ChapterNode[]> => {
  const response = await fetch(`/api/books/${bookId}/chapters`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch chapters');
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
  const response = await fetch('/api/chapters/order', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ updates }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update chapter order');
  }
  
  return { success: true };
};

// Hooks
export function useChapters(bookId: string) {
  return useQuery<ChapterNode[]>({
    queryKey: ['chapters', bookId],
    queryFn: () => fetchChaptersByBook(bookId),
    enabled: !!bookId,
  });
}

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
