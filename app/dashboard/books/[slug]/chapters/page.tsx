import { notFound, redirect } from "next/navigation";
import { BooksMenu } from "@/components/books/books-menu";
import { Separator } from "@/components/ui/separator";
import { getBookBySlug } from "@/actions/books/get-book-by-slug";
import { getChaptersByBook } from "@/actions/books/get-chapters-by-book";
import { ChapterTreeArborist } from "@/components/chapters/ChapterTreeArborist";
import type { Book } from "@/types/book";
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
export default async function BookDetailPage({ params, searchParams }: PageProps) {
  const { slug } = params;
  
  // Validate slug before proceeding
  if (!slug || typeof slug !== 'string') {
    redirect('/dashboard/books');
    return null;
  }
  
  // Handle potential error from searchParams
  const error = searchParams?.error as string | undefined;

  try {
    console.log(`[DEBUG] Fetching book with slug: ${slug}`);
    // First, get the book by slug
    console.log(`[DEBUG] Fetching book with slug: ${slug}`);
    const book = await getBookBySlug(slug) as Book & { id: string };
    console.log(`[DEBUG] Book fetch result:`, book ? 'Found' : 'Not found');
    if (!book) {
      console.error(`[ERROR] Book not found with slug: ${slug}`);
      notFound();
    }
    
    console.log(`[DEBUG] Book found - ID: ${book.id}, Title: "${book.title}"`);
    
    // Now fetch the chapters for this book using the slug
    console.log(`[DEBUG] Fetching chapters for book slug: ${slug}`);
    const bookChapters = await getChaptersByBook(slug);
    console.log(`[DEBUG] Fetched ${bookChapters.length} chapters for book ${slug}`);
    
    // Log the first few chapters for debugging
    if (bookChapters.length > 0) {
      console.log('[DEBUG] First 3 chapters sample:', bookChapters.slice(0, 3).map(ch => ({
        id: ch.id,
        title: ch.title,
        order: ch.order,
        parentChapterId: ch.parentChapterId,
        hasChildren: ch.children && ch.children.length > 0
      })));
    } else {
      console.log('[DEBUG] No chapters found for this book');
    }
    
    // Show error message if any
    if (error) {
      console.error('Error from search params:', error);
      // You can show this error to the user if needed
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
                window.location.href = `/dashboard/books/${slug}/chapters/${chapter.id}`;
              }}
              onEditChapter={(chapter) => {
                window.location.href = `/dashboard/books/${slug}/chapters/${chapter.id}/edit`;
              }}
              onDeleteChapter={async (chapter) => {
                if (confirm(`Are you sure you want to delete "${chapter.title}"?`)) {
                  try {
                    const response = await fetch(`/api/books/${slug}/chapters/${chapter.id}`, {
                      method: 'DELETE',
                    });
                    if (response.ok) {
                      window.location.reload();
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
  } catch (error) {
    console.error('Error loading book:', error);
    notFound();
  }
}
