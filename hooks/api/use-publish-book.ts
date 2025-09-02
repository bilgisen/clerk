import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import toast from "sonner";

type PublishBookParams = {
  slug: string;
};

type PublishResponse = {
  success: boolean;
  url?: string;
  error?: string;
  details?: unknown;
};

export function usePublishBook() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<PublishResponse, Error, PublishBookParams>({
    mutationFn: async ({ slug }): Promise<PublishResponse> => {
      const response = await fetch(`/api/books/${slug}/d/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      const data: PublishResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to publish book');
      }

      return data;
    },
    onSuccess: (data, { slug }) => {
      // Invalidate and refetch the book data
      queryClient.invalidateQueries({ queryKey: ['book', slug] });
      toast.success('Book published successfully!');
      router.refresh();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to publish book');
    },
  });
}
