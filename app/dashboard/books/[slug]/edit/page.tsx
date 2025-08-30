'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { BooksMenu } from '@/components/books/books-menu';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { BookInfoForm, type BookFormValues } from '@/components/books/forms/book-info-form';
import { useBook, useUpdateBook } from '@/hooks/api/use-books';
import type { Book } from '@/types/book';

export default function EditBookPage() {
  const router = useRouter();
  const { isLoaded, userId } = useAuth();
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  
  // Use the useBook hook to fetch book data
  const { data: book, isLoading, error: bookError } = useBook(slug, {
    enabled: !!slug && isLoaded && !!userId,
  });
  
  // Use the useUpdateBook hook for updating the book
  const { mutate: updateBook, isPending: isSubmitting } = useUpdateBook();
  
  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (isLoaded && !userId) {
      router.push('/sign-in');
    }
  }, [isLoaded, userId, router]);
  
  // Handle book fetch errors
  useEffect(() => {
    if (bookError) {
      toast.error(bookError.message || 'Failed to load book');
    }
  }, [bookError]);

  const handleSubmit = (formData: BookFormValues) => {
    if (!book) return;
    
    // Prepare the book data for update
    const bookData = {
      id: book.id,
      title: formData.title,
      description: formData.description || undefined,
      author: formData.author,
      subtitle: formData.subtitle || undefined,
      publisher: formData.publisher || undefined,
      publisherWebsite: formData.publisherWebsite || undefined,
      publishYear: formData.publishYear ? Number(formData.publishYear) : undefined,
      isbn: formData.isbn || undefined,
      language: formData.language || 'en',
      genre: formData.genre || 'OTHER',
      series: formData.series || undefined,
      seriesIndex: formData.seriesIndex ? Number(formData.seriesIndex) : undefined,
      tags: formData.tags || [],
      coverImageUrl: formData.coverImageUrl || undefined,
      isPublished: formData.isPublished,
      isFeatured: formData.isFeatured,
    };
    
    updateBook(bookData, {
      onSuccess: () => {
        toast.success('Book updated successfully!');
        // Redirect to the book's page
        router.push(`/dashboard/books/${book.slug}`);
      },
      onError: (error: Error) => {
        console.error('Error updating book:', error);
        toast.error(error.message || 'Failed to update book');
      },
    });
  };

  const handleCancel = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="container w-full p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Book not found</h2>
          <p className="text-muted-foreground mb-4">The book you're looking for doesn't exist or was deleted.</p>
          <Button onClick={() => router.push('/dashboard/books')}>
            Back to Books
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container w-full mx-auto py-10 px-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Edit Book</h1>
        <BooksMenu slug={book.slug} bookId={book.id} />
      </div>
      
      <Separator className="mb-6" />
      
      <div className="w-full mx-auto">
        <BookInfoForm
          onSubmit={handleSubmit}
          defaultValues={{
            title: book.title,
            slug: book.slug,
            author: book.author,
            subtitle: book.subtitle || '',
            description: book.description || '',
            publisher: book.publisher || '',
            publisherWebsite: book.publisherWebsite || '',
            // Convert publishYear to string for the form input
            publishYear: book.publishYear ?? undefined,
            isbn: book.isbn || '',
            language: book.language || 'en',
            genre: book.genre || 'OTHER',
            series: book.series || '',
            // Convert seriesIndex to number for the form input
            seriesIndex: book.seriesIndex ?? undefined,
            // Ensure tags is always an array of strings
            tags: Array.isArray(book.tags) ? book.tags : (book.tags ? [String(book.tags)] : []),
            coverImageUrl: book.coverImageUrl || '',
            isPublished: book.isPublished,
            isFeatured: book.isFeatured,
          }}
        />
      </div>
    </div>
  );
}
