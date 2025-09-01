'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { notFound } from 'next/navigation';
import { BooksMenu } from "@/components/books/books-menu";
import { Separator } from "@/components/ui/separator";
import { BookInfo } from "@/components/books/book-info";
import { Skeleton } from "@/components/ui/skeleton";
import { useBook, useDeleteBook } from "@/hooks/api/use-books";
import toast from "sonner";

interface PageProps {
  params: { slug: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}

export default function BookDetailPage({ params, searchParams }: PageProps) {
  const router = useRouter();
  const { slug } = params;
  const { data: book, isLoading, error } = useBook(slug, { bySlug: true });
  const deleteBook = useDeleteBook();

  useEffect(() => {
    if (error) {
      console.error('Error loading book:', error);
      router.push('/dashboard/books');
    }
  }, [error, router]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
        <Separator className="my-6" />
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (!book) {
    router.push('/dashboard/books');
    return null;
  }

  // Simplified language display
  const formatLanguage = (lang: string | null | undefined) => {
    return lang?.toUpperCase() || 'Not specified';
  };

  // Define the field type
  type BookField = {
    label: string;
    value: string | number | null;
    fullWidth?: boolean;
  };
  
  // Type guard for BookField
  const isValidField = (field: BookField): field is BookField & { value: string | number } => {
    return field.value !== null && field.value !== '';
  };

  // Format book details into fields
  const bookFields = [
    { label: 'Title', value: book.title },
    { label: 'Subtitle', value: book.subtitle },
    { label: 'Author', value: book.author },
    { label: 'Contributor', value: book.contributor },
    { label: 'Publisher', value: book.publisher },
    { 
      label: 'Publication Year', 
      value: book.publishYear ? new Date(book.publishYear).getFullYear() : null 
    },
    { label: 'Language', value: formatLanguage(book.language) },
    { label: 'ISBN', value: book.isbn },
    { label: 'Description', value: book.description, fullWidth: true },
  ].filter(isValidField);

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{book.title}</h1>
            <p className="text-muted-foreground">
              {book.author}
              {book.publisher && ` • ${book.publisher}`}
            </p>
          </div>
          <BooksMenu 
            slug={slug} 
            bookId={book.id} 
            onDelete={async () => {
              try {
                await new Promise((resolve, reject) => {
                  deleteBook.mutate(book.id, {
                    onSuccess: () => resolve(true),
                    onError: (error) => reject(error)
                  });
                });
                return { success: true };
              } catch (error) {
                console.error('Error deleting book:', error);
                return { 
                  success: false, 
                  error: error instanceof Error ? error.message : 'Failed to delete book' 
                };
              }
            }}
          />
        </div>
        <Separator className="my-4" />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Sidebar - Book Info (1/3) */}
        <div className="lg:col-span-1">
          <BookInfo 
            book={{
              id: book.id,
              title: book.title,
              author: book.author || '',
              publisher: book.publisher || '',
              coverImageUrl: book.coverImageUrl || ''
            }}
            showEditButton={false}
            className="sticky top-6"
          />
        </div>

        {/* Right Content - Book Fields (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {bookFields.map((field, index) => (
              <div 
                key={index} 
                className={field.fullWidth ? 'md:col-span-2' : ''}
              >
                <h3 className="text-sm font-medium text-muted-foreground">
                  {field.label}
                </h3>
                <p className="mt-1">
                  {field.value || '-'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}