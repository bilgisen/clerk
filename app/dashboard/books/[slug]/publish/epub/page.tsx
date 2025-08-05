'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

// UI Components
import { BooksMenu } from '@/components/books/books-menu';
import { Separator } from '@/components/ui/separator';

// Custom Components
import { EpubGenerationForm } from '@/components/books/publish/epub/EpubGenerationForm';

export default function PublishEpubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();

  // Fetch book data using TanStack Query
  const { data: response, isLoading, error } = useQuery({
    queryKey: ['book', slug],
    queryFn: async () => {
      if (!slug) {
        router.push('/dashboard/books');
        throw new Error('No book slug provided');
      }
      
      console.log('Fetching book data for slug:', slug);
      const response = await fetch(`/api/books/by-slug/${slug}`);
      if (!response.ok) {
        console.error('Failed to fetch book data:', response.status, response.statusText);
        throw new Error('Failed to load book data');
      }
      const data = await response.json();
      console.log('Received book data:', data);
      return data;
    },
    enabled: !!slug,
  });

  // Extract book data from response
  const book = response?.data;

  // Handle loading and error states
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Loading book data...</span>
      </div>
    );
  }

  if (error) {
    toast.error('Failed to load book data');
    router.push('/dashboard/books');
    return null;
  }

  if (!book) {
    router.push('/dashboard/books');
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-8">
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Publish EPUB</h1>
            <p className="text-muted-foreground">
              Generate and download your book as an EPUB file
            </p>
          </div>
          <BooksMenu slug={slug} activeTab="epub" />
        </div>

        <Separator />

        <EpubGenerationForm 
          bookSlug={slug}
          book={{
            id: book.id,
            title: book.title,
            slug: book.slug,
            author: book.author || 'Unknown Author',
            publisher: book.publisher || 'Unknown Publisher',
            description: book.description || undefined,
            isbn: book.isbn || undefined,
            publish_year: book.publish_year || undefined,
            language: book.language || undefined,
            cover_image_url: book.coverImageUrl || book.cover_image_url || undefined,
            userId: book.userId || book.user_id,
            created_at: book.created_at || book.createdAt || new Date().toISOString(),
            updated_at: book.updated_at || book.updatedAt || new Date().toISOString(),
            user_id: book.user_id || book.userId,
            coverImage: book.coverImage || book.cover_image_url || book.coverImageUrl || undefined
          }}
        />
      </div>
    </div>
  );
}
