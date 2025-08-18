'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import BooksPage from './books-client';
import { useBooks } from '@/hooks/api/use-books';
import { Book } from '@/types/book';

// Helper function to map database book to our Book type
const mapToBook = (dbBook: any): Book => ({
  ...dbBook,
  // Ensure all required fields are present with proper types
  id: dbBook.id,
  userId: dbBook.userId,
  title: dbBook.title,
  slug: dbBook.slug,
  author: dbBook.author,
  subtitle: dbBook.subtitle || null,
  description: dbBook.description || null,
  publisher: dbBook.publisher || null,
  publisherWebsite: dbBook.publisherWebsite || null,
  publishYear: dbBook.publishYear || null,
  isbn: dbBook.isbn || null,
  language: dbBook.language || 'en',
  genre: dbBook.genre || 'OTHER',
  series: dbBook.series || null,
  seriesIndex: dbBook.seriesIndex || null,
  tags: dbBook.tags || [],
  coverImageUrl: dbBook.coverImageUrl || null,
  isPublished: dbBook.isPublished || false,
  isFeatured: dbBook.isFeatured || false,
  viewCount: dbBook.viewCount || 0,
  // Handle timestamps with fallbacks
  createdAt: dbBook.createdAt || dbBook.created_at || new Date().toISOString(),
  updatedAt: dbBook.updatedAt || dbBook.updated_at || new Date().toISOString(),
  publishedAt: dbBook.publishedAt || null,
  // Snake case aliases for backward compatibility
  created_at: dbBook.created_at || dbBook.createdAt || new Date().toISOString(),
  updated_at: dbBook.updated_at || dbBook.updatedAt || new Date().toISOString(),
  // Optional fields
  contributor: dbBook.contributor || null,
  translator: dbBook.translator || null,
  epubUrl: dbBook.epubUrl || null
});

export default function BooksPageWrapper() {
  const router = useRouter();
  const { isLoaded, userId } = useAuth();
  const { data: books = [], isLoading, error } = useBooks();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isLoaded && !userId) {
      router.push('/sign-in');
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
        Error loading books: {error.message}
      </div>
    );
  }

  console.log('Raw books data from API:', books);
  console.log('Raw books data from API (before mapping):', JSON.stringify(books, null, 2));
  
  const mappedBooks = books.map(book => {
    console.log('Mapping book:', book);
    const mapped = mapToBook(book);
    console.log('Mapped book:', mapped);
    return mapped;
  });
  
  console.log('Mapped books array:', mappedBooks);
  
  if (mappedBooks.length === 0) {
    console.log('No books found after mapping. Raw data was:', books);
  }
  
  return <BooksPage initialBooks={mappedBooks} />;
}
