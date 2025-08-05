import { notFound, redirect } from "next/navigation";
import { BooksMenu } from "@/components/books/books-menu";
import { Separator } from "@/components/ui/separator";
import { getBookBySlug } from "@/actions/books/get-book-by-slug";
import type { Book } from "@/types/book";
import { BookOpen, Globe, User } from "lucide-react";

interface PageProps {
  params: { slug: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}

// Separate component for the book header section
function BookHeader({ book, slug }: { book: Book; slug: string }) {
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
        <BooksMenu slug={slug} />
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
    // Fetch book data
    const book = await getBookBySlug(slug);
    console.log(`[DEBUG] Book fetch result:`, book ? 'Found' : 'Not found');
    if (!book) {
      console.log(`[ERROR] Book not found with slug: ${slug}`);
      notFound();
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

    // Format language for display
    const formatLanguage = (lang: string | null | undefined) => {
      if (!lang) return 'Not specified';
      return lang === 'tr' ? 'Türkçe' :
             lang === 'en' ? 'English' :
             lang.toUpperCase();
    };
    
    return (
      <div className="container mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <BookHeader book={book} slug={slug} />
        <Separator className="my-6" />
        
        <div className="space-y-8">
          {/* Book Title */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {book.title}
            </h1>
            {book.subtitle && (
              <h2 className="text-xl text-muted-foreground mt-1">
                {book.subtitle}
              </h2>
            )}
          </div>

          {/* Book Details */}
          <div className="space-y-4">
            {/* Author */}
            <div className="flex items-center text-muted-foreground">
              <User className="h-5 w-5 mr-2 flex-shrink-0" />
              <span className="text-foreground">{book.author || 'Unknown Author'}</span>
            </div>

            {/* Publisher */}
            <div className="flex items-center text-muted-foreground">
              <BookOpen className="h-5 w-5 mr-2 flex-shrink-0" />
              <span>{book.publisher || 'No publisher specified'}</span>
            </div>

            {/* Language */}
            <div className="flex items-center text-muted-foreground">
              <Globe className="h-5 w-5 mr-2 flex-shrink-0" />
              <span>Language: {formatLanguage(book.language)}</span>
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
