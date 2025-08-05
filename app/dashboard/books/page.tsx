'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/books/book-table/data-table';
import { getColumns } from '@/components/books/book-table/columns';
import { Book } from '@/types/book';
import { getBooks } from '@/actions/books/get-books';
import { ColumnDef } from '@tanstack/react-table';

export default function BooksPage() {
  const router = useRouter();
  const { isLoaded, userId } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (isLoaded && !userId) {
      router.push('/sign-in');
    }
  }, [isLoaded, userId, router]);

  const handleNewBook = () => {
    router.push('/dashboard/books/new');
  };

  const handleViewBook = (slug: string) => {
    router.push(`/dashboard/books/${slug}`);
  };

  const handleEditBook = (id: string) => {
    router.push(`/dashboard/books/edit/${id}`);
  };

  const handleDeleteBook = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) {
      return;
    }

    try {
      // First get the book to get its slug
      const bookResponse = await fetch(`/api/books/by-id/${id}`);
      if (!bookResponse.ok) {
        throw new Error('Failed to fetch book details');
      }
      const book = await bookResponse.json();

      // Then delete using the slug
      const response = await fetch(`/api/books/by-slug/${book.slug}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete book');
      }

      // Refresh the books list
      await fetchBooks();
      toast.success('Book deleted successfully');
    } catch (error) {
      console.error('Error deleting book:', error);
      toast.error('Failed to delete book');
    }
  };

  const handleAddChapter = (bookId: string) => {
    router.push(`/dashboard/books/${bookId}/chapters/new`);
  };

  // Get the columns definition and make the title clickable
  const columns = useMemo(() => {
    const baseColumns = getColumns();
    return baseColumns.map(column => {
      // Type assertion to access accessorKey safely
      const columnWithAccessor = column as { accessorKey?: string } & ColumnDef<Book>;
      
      if (columnWithAccessor.accessorKey === 'title') {
        return {
          ...column,
          cell: ({ row }: { row: { original: Book; getValue: (key: string) => any } }) => (
            <button 
              onClick={() => handleViewBook(row.original.slug)}
              className="hover:underline text-left w-full"
            >
              {row.getValue('title')}
            </button>
          )
        } as ColumnDef<Book>;
      }
      return column;
    });
  }, []);

  const fetchBooks = async () => {
    if (!isLoaded || !userId) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await getBooks();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      if (result.data) {
        // Map the database fields to the Book type
        const formattedBooks = result.data.map((book: any) => ({
          id: book.id,
          userId: book.userId,
          title: book.title,
          slug: book.slug,
          author: book.author || '',
          subtitle: book.subtitle || null,
          description: book.description || null,
          publisher: book.publisher || null,
          publisherWebsite: book.publisherWebsite || null,
          publishYear: book.publishYear || null,
          isbn: book.isbn || null,
          language: book.language || 'en',
          genre: book.genre || 'OTHER',
          series: book.series || null,
          seriesIndex: book.seriesIndex || null,
          tags: book.tags || null,
          coverImageUrl: book.coverImageUrl || null,
          isPublished: book.isPublished || false,
          isFeatured: book.isFeatured || false,
          viewCount: book.viewCount || 0,
          createdAt: book.createdAt || book.created_at || new Date().toISOString(),
          updatedAt: book.updatedAt || book.updated_at || new Date().toISOString(),
          publishedAt: book.publishedAt || null,
          created_at: book.created_at || book.createdAt || new Date().toISOString(),
          updated_at: book.updated_at || book.updatedAt || new Date().toISOString(),
        } as Book));
        
        setBooks(formattedBooks);
      }
    } catch (err) {
      console.error('Error fetching books:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load books';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && userId) {
      fetchBooks();
    }
  }, [isLoaded, userId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-destructive">{error}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Books</h1>
        <Button onClick={handleNewBook}>
          <Plus className="mr-2 h-4 w-4" />
          New Book
        </Button>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      
      <div className="rounded-md border">
        <DataTable 
          columns={columns} 
          data={books}
        />
      </div>


    </div>
  );
}
