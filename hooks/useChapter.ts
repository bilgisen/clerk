// 
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { updateChapterSchema } from '@/lib/validations/chapter';
import type { z } from 'zod';

// Get a single chapter by ID
export function useChapter<T = any>(chapterId: string) {
  return useQuery<T>({
    queryKey: ['chapters', chapterId],
    queryFn: async () => {
      const res = await fetch(`/api/chapters/${chapterId}`);
      if (!res.ok) throw new Error('Failed to fetch chapter');
      return res.json();
    },
  });
}

// Update a chapter
export function useUpdateChapter() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      chapterId, 
      data 
    }: { 
      chapterId: string; 
      data: z.infer<typeof updateChapterSchema>;
    }) => {
      const res = await fetch(`/api/chapters/${chapterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update chapter');
      return res.json();
    },
    onSuccess: (_, { chapterId }) => {
      queryClient.invalidateQueries({ 
        queryKey: ['chapters', chapterId] 
      });
      queryClient.invalidateQueries({
        queryKey: ['books']
      });
    },
  });
}

// Delete a chapter
export function useDeleteChapter() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (chapterId: string) => {
      const res = await fetch(`/api/chapters/${chapterId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete chapter');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['books']
      });
    },
  });
}
