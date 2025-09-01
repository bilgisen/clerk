'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import toast from "sonner";
import { Loader2 } from 'lucide-react';
import { BooksMenu } from '@/components/books/books-menu';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { BookInfoForm, type BookFormValues } from '@/components/books/forms/book-info-form';
import { useBook, useUpdateBook } from '@/hooks/api/use-books';
import type { Book } from '@/types/book';

export default function EditBookPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  
  // Use the useBook hook to fetch book data
  const { data: book, isLoading: isBookLoading, error: bookError } = useBook(slug, {
    enabled: !!slug && !isAuthLoading && !!user?.id,
  });
  
  // Use the useUpdateBook hook for updating the book
  const { mutate: updateBook, isPending: isSubmitting } = useUpdateBook();
  
  useEffect(() => {
    if (!isAuthLoading && !user) {
      // Redirect to sign-in if not authenticated
      router.push('/signin');
      toast.error('Please sign in to edit this book');
    }
  }, [user, isAuthLoading, router]);

  // Transform book data to match form values
  const defaultValues = book ? {
    title: book.title || '',
    author: book.author || '',
    publisher: book.publisher || '',
    slug: book.slug || '',
    language: book.language || 'en',
    isPublished: book.isPublished || false,
    isFeatured: book.isFeatured || false,
    // Optional fields
    ...(book.contributor && { contributor: book.contributor }),
    ...(book.translator && { translator: book.translator }),
    ...(book.subtitle && { subtitle: book.subtitle }),
    ...(book.description && { description: book.description }),
    ...(book.publisherWebsite && { publisherWebsite: book.publisherWebsite }),
    ...(book.publishYear && { publishYear: book.publishYear }),
    ...(book.isbn && { isbn: book.isbn }),
    ...(book.genre && { genre: book.genre }),
    ...(book.series && { series: book.series }),
    ...(book.seriesIndex && { seriesIndex: book.seriesIndex }),
    ...(book.tags && { tags: Array.isArray(book.tags) ? book.tags : [String(book.tags)] }),
    ...(book.coverImageUrl && { coverImageUrl: book.coverImageUrl })
  } : undefined;

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

  if (isBookLoading || isAuthLoading) {
    return (
      <div className="flex items-center justify-center h-64">
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
    <div className="container w-full p-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Edit Book</h1>
            <p className="text-muted-foreground">Update your book details</p>
          </div>
          <div className="flex items-center gap-2">
            <BooksMenu slug={book.slug} bookId={book.id} />
            <Button onClick={handleCancel} variant="outline">
              Cancel
            </Button>
          </div>
        </div>
        <Separator />
        {defaultValues && (
          <BookInfoForm
            defaultValues={defaultValues}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    </div>
  );
}
