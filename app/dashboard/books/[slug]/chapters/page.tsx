'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Book } from "@/types/book";
import { BooksMenu } from "@/components/books/books-menu";
import { Separator } from "@/components/ui/separator";
import { ChapterTreeArborist } from "@/components/chapters/ChapterTreeArborist";
import { BookInfo } from "@/components/books/book-info";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface PageProps {
  params: { slug: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}

// Separate component for the book header section
function BookHeader({ book, slug }: { book: Book & { id: string }; slug: string }) {
  return (
    <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {book.title}
        </h1>
        {book.author && (
          <p className="text-muted-foreground">{book.author}</p>
        )}
      </div>
      <div className="flex-shrink-0">
        <BooksMenu slug={slug} bookId={book.id} />
      </div>
    </div>
  );
}

/**
 * Book detail page component that displays a single book and its chapters
 * @param params - The route parameters containing the book slug
 */
export default function BookDetailPage({ params, searchParams }: PageProps) {
  const { slug } = params;
  const router = useRouter();
  const { getToken } = useAuth();
  const [book, setBook] = useState<Book & { id: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const token = await getToken();
        
        // Fetch book data
        const bookResponse = await fetch(`/api/books/${slug}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!bookResponse.ok) {
          throw new Error('Failed to fetch book');
        }
        
        const bookData = await bookResponse.json();
        setBook(bookData);
        
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load book data');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (slug && typeof slug === 'string') {
      fetchData();
    } else {
      router.push('/dashboard/books');
    }
  }, [slug, getToken, router]);

  if (isLoading) {
    return (
      <div className="container mx-auto w-full p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="container mx-auto w-full p-6">
        <div className="text-red-500 text-center py-8">
          {error || 'Book not found'}
        </div>
      </div>
    );
  }
  
  // Format publication year if available
  const publishYear = book.publishYear 
    ? new Date(book.publishYear).getFullYear()
    : null;

  return (
      <div className="container mx-auto w-full p-6">
        {/* Header Section */}
        <div className="flex flex-col space-y-2 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Chapters of {book.title}</h1>
              <p className="text-muted-foreground">
                You can change the order and hierarchy of chapters using drag-and-drop.
              </p>
            </div>
            <BooksMenu slug={slug} bookId={book.id} />
          </div>
          <Separator className="my-4" />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Chapter Tree (2/3) */}
          <div className="lg:col-span-2">
            <ChapterTreeArborist 
              bookSlug={slug}
              onViewChapter={(chapter) => {
                router.push(`/dashboard/books/${slug}/chapters/${chapter.id}`);
              }}
              onEditChapter={(chapter) => {
                router.push(`/dashboard/books/${slug}/chapters/${chapter.id}/edit`);
              }}
              onDeleteChapter={async (chapter) => {
                if (confirm(`Are you sure you want to delete "${chapter.title}"?`)) {
                  try {
                    const token = await getToken();
                    const response = await fetch(`/api/books/${slug}/chapters/${chapter.id}`, {
                      method: 'DELETE',
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    
                    if (response.ok) {
                      router.refresh();
                    } else {
                      const error = await response.json();
                      alert(error.message || 'Failed to delete chapter');
                    }
                  } catch (error) {
                    console.error('Error deleting chapter:', error);
                    alert('An error occurred while deleting the chapter');
                  }
                }
              }}
            />
          </div>
          
          {/* Right Column - Book Info (1/3) */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <BookInfo 
                book={{
                  id: book.id,
                  title: book.title,
                  author: book.author,
                  publisher: book.publisher,
                  coverImageUrl: book.coverImageUrl
                }}
                showEditButton={false}
              />
            </div>
          </div>
        </div>
      </div>
    );
}
