'use server';

import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import BooksPage from './books-client';
import { getBooks } from '@/actions/books/get-books';
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

export default async function BooksPageWrapper() {
  try {
    // This runs on the server side
    const { userId } = await auth();
    
    if (!userId) {
      console.log('[BooksPage] No user session found, redirecting to sign-in');
      redirect('/sign-in');
    }
    console.log(`[BooksPage] Fetching books for user ${userId}`);
    
    // Fetch books on the server side
    const result = await getBooks();
    
    if (result.error) {
      console.error('[BooksPage] Error fetching books:', result.error);
      
      // Handle 401 Unauthorized
      if (result.status === 401) {
        console.log('[BooksPage] Unauthorized, redirecting to sign-in');
        redirect('/sign-in');
      }
      
      // For other errors, show an error message
      return (
        <div className="p-4">
          <h1 className="text-xl font-bold mb-2">Error loading books</h1>
          <p className="text-red-600 dark:text-red-400">
            {result.error}
            {result.details && (
              <span className="block text-sm mt-1 text-gray-600 dark:text-gray-400">
                {result.details}
              </span>
            )}
          </p>
        </div>
      );
    }
    
    // Map database books to our Book type
    const books: Book[] = (result.data || []).map(mapToBook);
    console.log(`[BooksPage] Successfully fetched ${books.length} books`);
    
    // Pass the pre-fetched books to the client component
    return <BooksPage initialBooks={books} />;
    
  } catch (error) {
    console.error('[BooksPage] Unexpected error:', error);
    return (
      <div className="p-4">
        <h1 className="text-xl font-bold mb-2">Unexpected Error</h1>
        <p className="text-red-600 dark:text-red-400">
          An unexpected error occurred. Please try again later.
          {process.env.NODE_ENV === 'development' && (
            <span className="block text-sm mt-1 text-gray-600 dark:text-gray-400">
              {error instanceof Error ? error.message : String(error)}
            </span>
          )}
        </p>
      </div>
    );
  }
}
