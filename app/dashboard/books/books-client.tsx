'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Book } from '@/types/book';
import { useAuth } from '@clerk/nextjs';
import { BookTable } from '@/components/books/book-table';

interface BooksPageProps {
  initialBooks: Book[];
}

export default function BooksPage({ initialBooks = [] }: BooksPageProps) {
  const router = useRouter();
  const { userId, sessionId, getToken } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [books, setBooks] = useState<Book[]>(initialBooks);
  
  console.log('[BooksPage] Initial props:', { initialBooks });
  
  // Log auth state and initialize
  useEffect(() => {
    console.log('[BooksClient] Auth state:', { userId, sessionId });
    
    const initialize = async () => {
      try {
        const token = await getToken();
        console.log('[BooksClient] Auth token:', token ? 'present' : 'missing');
      } catch (err) {
        console.error('[BooksClient] Error getting auth token:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    initialize();
  }, [userId, sessionId, getToken]);
  
  // Update books when initialBooks changes
  useEffect(() => {
    console.log('[BooksPage] initialBooks changed:', initialBooks);
    if (initialBooks.length > 0) {
      console.log('[BooksPage] Setting books state with:', initialBooks);
      setBooks(initialBooks);
    }
  }, [initialBooks]);
  
  // Handle book deletion
  const handleDeleteBook = async (bookId: string) => {
    if (!confirm('Are you sure you want to delete this book?')) return;
    
    try {
      const response = await fetch(`/api/books/${bookId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete book');
      }
      
      // Update local state to remove the deleted book
      setBooks(prevBooks => prevBooks.filter(book => book.id !== bookId));
      
      toast.success('Book deleted successfully');
    } catch (error) {
      console.error('[BooksClient] Error deleting book:', error);
      toast.error('Failed to delete book', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }
  
  console.log('[BooksPage] Rendering with books:', books);
  
  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Books</h1>
        <Button onClick={() => router.push('/dashboard/books/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Add Book
        </Button>
      </div>
      
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          {books.length} book{books.length !== 1 ? 's' : ''} found
        </p>
      </div>
      
      <BookTable 
        data={books} 
        isLoading={isLoading}
        onDelete={handleDeleteBook}
      />
    </div>
  );
}
