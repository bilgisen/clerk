'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { BooksMenu } from '@/components/books/books-menu';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { BookInfoForm, type BookFormValues } from '@/components/books/forms/book-info-form';
import { updateBook } from '@/actions/books/update-book';
import { getBookBySlug } from '@/actions/books/get-book-by-slug';
import type { Book } from '@/types/book';

type UpdateBookResponse = {
  success: boolean;
  data?: Book;
  error?: string;
};

export default function EditBookPage() {
  const router = useRouter();
  const { isLoaded, userId } = useAuth();
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (isLoaded && !userId) {
      router.push('/sign-in');
    }
  }, [isLoaded, userId, router]);

  // Fetch book data
  useEffect(() => {
    const fetchBook = async () => {
      if (!isLoaded || !userId || !slug) return;
      
      try {
        setIsLoading(true);
        setError(null);
        
        const bookData = await getBookBySlug(slug);
        
        if (!bookData) {
          throw new Error('Book not found');
        }
        
        setBook(bookData);
      } catch (err) {
        console.error('Error fetching book:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load book';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBook();
  }, [isLoaded, userId, slug]);

  const handleSubmit = async (formValues: BookFormValues) => {
    if (!book) return;
    
    try {
      setIsSubmitting(true);
      
      // Create FormData first to avoid naming conflicts
      const formData = new FormData();
      
      // Helper function to handle different field types
      const appendFormData = (key: string, value: unknown) => {
        if (value === undefined || value === null) return;
        
        if (Array.isArray(value)) {
          // Handle arrays (like tags)
          value.forEach((item: unknown) => {
            if (item !== undefined && item !== null) {
              formData.append(key, String(item));
            }
          });
        } else if (value instanceof File) {
          // Handle file uploads
          formData.append(key, value);
        } else if (typeof value === 'object') {
          // Stringify objects
          formData.append(key, JSON.stringify(value));
        } else if (value !== '') {
          // Convert all other values to strings
          formData.append(key, String(value));
        }
      };
      
      // Process form values with proper type conversion and field names
      const { publishYear, seriesIndex, coverImageUrl, ...restFormValues } = formValues;
      
      // Create a plain object with the correct field names for the server
      const bookData = {
        ...restFormValues,
        // Convert field names to match server expectations
        publish_year: publishYear ? Number(publishYear) : null,
        series_index: seriesIndex ? Number(seriesIndex) : null,
        cover_image_url: coverImageUrl || '',
        // Ensure tags is always an array of strings and not empty
        tags: JSON.stringify(
          Array.isArray(formValues.tags) 
            ? formValues.tags.filter(Boolean)
            : formValues.tags 
              ? [formValues.tags].filter(Boolean)
              : []
        )
      };
      
      // Helper function to check if value is a File or Blob
      const isFileOrBlob = (value: unknown): value is File | Blob => {
        return (
          (typeof File !== 'undefined' && value instanceof File) ||
          (typeof Blob !== 'undefined' && value instanceof Blob)
        );
      };

      // Add all fields to FormData
      Object.entries(bookData).forEach(([key, value]) => {
        if (value === null || value === undefined) return;
        
        if (Array.isArray(value)) {
          // Stringify arrays before adding to FormData
          formData.append(key, JSON.stringify(value));
        } else if (isFileOrBlob(value)) {
          // Handle both Blob and File types
          formData.append(key, value);
        } else if (typeof value === 'object') {
          // Stringify objects before adding to FormData
          formData.append(key, JSON.stringify(value));
        } else {
          // Convert all other values to strings
          formData.append(key, String(value));
        }
      });
      
      // Add the book ID
      formData.append('id', book.id);
      
      // Log the data being sent for debugging
      console.log('Submitting form data:', Object.fromEntries(formData.entries()));
      
      // Call the updateBook action with the FormData
      const result = await updateBook(formData);
      
      if (result.success) {
        toast.success('Book updated successfully!');
        // Redirect to the book's page using the redirectUrl from the response
        if (result.redirectUrl) {
          router.push(result.redirectUrl);
        } else {
          // Fallback in case redirectUrl is not provided
          router.push(`/dashboard/books/${book.slug}`);
        }
      } else {
        throw new Error(result.error || 'Failed to update book');
      }
    } catch (error) {
      console.error('Error updating book:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
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

  if (error) {
    return (
      <div className="container w-full   py-10 px-10">
        <div className="bg-destructive/15 border border-destructive text-destructive px-4 py-3 rounded-md">
          <p>{error}</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Try Again
          </Button>
        </div>
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
        <BooksMenu slug={book.slug} />
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
            tags: Array.isArray(book.tags) ? book.tags : (book.tags ? [book.tags] : []),
            coverImageUrl: book.coverImageUrl || '',
            isPublished: book.isPublished,
            isFeatured: book.isFeatured,
          }}
        />
      </div>
    </div>
  );
}
