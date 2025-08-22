'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import BooksPage from './books-client';
import { Book } from '@/types/book';

// This is a client component that wraps the actual books page
export default function BooksPageWrapper() {
  const router = useRouter();
  const { isLoaded, userId } = useAuth();
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch books from the API
  const fetchBooks = async () => {
    if (!userId) return;
    
    try {
      setIsLoading(true);
      const response = await fetch('/api/books');
      
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
    
    if (isLoaded && !userId) {
      router.push('/sign-in');
    } else if (userId) {
      fetchBooks();
    }
  }, [isLoaded, userId, router]);

  if (!isClient || !isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
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

  console.log('Raw books data from API:', books);
  console.log('Raw books data from API (before mapping):', JSON.stringify(books, null, 2));
  
  const mappedBooks = books.map(book => ({
    ...book,
    // Ensure all required fields are present with proper types
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
