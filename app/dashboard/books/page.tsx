// app/dashboard/books/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import BooksPage from './books-client';
import { Book } from '@/types/book';

// This is a client component that wraps the actual books page
export default function BooksPageWrapper() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch books from the API
  const fetchBooks = async () => {
    if (!user?.id) {
      setError('User not authenticated');
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/books?userId=${user.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch books');
      }
      
      const data = await response.json();
      setBooks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching books:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsClient(true);
    
    if (loading) return;
    
    if (!user) {
      router.push('/signin');
      return;
    }
    
    fetchBooks();
  }, [loading, user, router]);

  if (!isClient) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-48 bg-muted rounded animate-pulse mb-2" />
            <div className="h-4 w-64 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-10 w-32 bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-[3/4] w-full bg-muted rounded-lg animate-pulse" />
              <div className="space-y-2">
                <div className="h-5 w-3/4 bg-muted rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-red-500">
        Error loading books: {error}
      </div>
    );
  }

  // Map books to ensure all required fields are present with proper types
  const mappedBooks = books.map(book => ({
    ...book,
    id: book.id,
    userId: book.userId,
    title: book.title || 'Untitled',
    slug: book.slug || '',
    author: book.author || 'Unknown',
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
    tags: Array.isArray(book.tags) ? book.tags : [],
    coverImageUrl: book.coverImageUrl || null,
    isPublished: Boolean(book.isPublished),
    isFeatured: Boolean(book.isFeatured),
    viewCount: Number(book.viewCount) || 0,
    createdAt: book.createdAt || new Date().toISOString(),
    updatedAt: book.updatedAt || new Date().toISOString(),
    publishedAt: book.publishedAt || null,
    contributor: book.contributor || null,
    translator: book.translator || null,
    epubUrl: book.epubUrl || null
  }));
  
  console.log('Mapped books array:', mappedBooks);
  
  if (mappedBooks.length === 0) {
    console.log('No books found after mapping. Raw data was:', books);
  }
  
  return <BooksPage initialBooks={mappedBooks} />;
}
