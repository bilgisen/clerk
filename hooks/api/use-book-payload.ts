'use client';

import { useQuery } from '@tanstack/react-query';

// Types for the book payload API response
type EbookPayload = {
  book: {
    slug: string;
    title: string;
    author: string;
    language?: string;
    output_filename: string;
    cover_url: string;
    stylesheet_url: string;
    subtitle?: string;
    description?: string;
    chapters: Array<{
      id: string;
      title: string;
      slug: string;
      url: string;
      content_url: string;
      content: string;
      order: number;
      parent: string | null;
      title_tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    }>;
  };
  options: {
    generate_toc: boolean;
    toc_depth: number;
    embed_metadata: boolean;
    include_imprint: boolean;
    cover: boolean;
  };
};

type ApiResponse<T> = {
  data: T;
  error?: string;
  message?: string;
};

type BookPayloadResponse = ApiResponse<EbookPayload>;

type UseBookPayloadOptions = {
  bookId: string;
  format?: 'epub' | 'mobi';
  generateToc?: boolean;
  includeImprint?: boolean;
  style?: string;
  tocDepth?: number;
  language?: string;
  enabled?: boolean;
};

export function useBookPayload({
  bookId,
  format = 'epub',
  generateToc = true,
  includeImprint = true,
  style = 'default',
  tocDepth = 3,
  language,
  enabled = true,
}: UseBookPayloadOptions) {
  return useQuery<BookPayloadResponse>({
    queryKey: ['book-payload', bookId, { format, generateToc, includeImprint, style, tocDepth, language }],
    queryFn: async (): Promise<BookPayloadResponse> => {
      if (!bookId) {
        throw new Error('Book ID is required');
      }

      const params = new URLSearchParams({
        format,
        generate_toc: generateToc.toString(),
        include_imprint: includeImprint.toString(),
        style,
        toc_depth: tocDepth.toString(),
        ...(language && { language }),
      });

      const response = await fetch(`/api/books/by-id/${bookId}/payload?${params.toString()}`);
      
      if (!response.ok) {
        let errorMessage = 'Failed to fetch book payload';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
          const error = new Error(errorMessage) as any;
          error.status = response.status;
          throw error;
        } catch (e) {
          const error = new Error(errorMessage) as any;
          error.status = response.status;
          throw error;
        }
      }

      return response.json();
    },
    // Don't retry on 401 Unauthorized or 404 Not Found
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 404) {
        return false;
      }
      return failureCount < 3; // Retry up to 3 times for other errors
    },
    enabled: enabled && !!bookId,
    // Cache the payload for 5 minutes
    staleTime: 5 * 60 * 1000,
  });
}

// Helper hook to get the book payload with default options
export function useDefaultBookPayload(bookId: string) {
  return useBookPayload({
    bookId,
    format: 'epub',
    generateToc: true,
    includeImprint: true,
    style: 'default',
    tocDepth: 3,
  });
}
