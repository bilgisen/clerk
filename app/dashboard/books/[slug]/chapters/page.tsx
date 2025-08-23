import { notFound, redirect } from "next/navigation";
import { BooksMenu } from "@/components/books/books-menu";
import { Separator } from "@/components/ui/separator";
import { getBookBySlug } from "@/actions/books/get-book-by-slug";
import { getChaptersByBook } from "@/actions/books/get-chapters-by-book";
import { ChapterTreeArborist } from "@/components/chapters/ChapterTreeArborist";
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
    // First, get the book by slug
    console.log(`[DEBUG] Fetching book with slug: ${slug}`);
    const book = await getBookBySlug(slug);
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

    // Format language for display
    const formatLanguage = (lang: string | null | undefined) => {
      if (!lang) return 'Not specified';
      return lang === 'tr' ? 'Türkçe' :
             lang === 'en' ? 'English' :
             lang.toUpperCase();
    };
    
    return (
      <div className="container mx-auto w-full space-y-6 p-8 md:p-8">
        <BookHeader book={book} slug={slug} />
        <Separator className="my-6" />
        
        <div className="space-y-6">
          {/* Book Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-4">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">Book Details</h2>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <User className="h-5 w-5 mr-2 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-sm text-muted-foreground">Author</p>
                      <p className="font-medium">{book.author || 'Unknown Author'}</p>
                    </div>
                  </div>
                  
                  {book.publisher && (
                    <div className="flex items-center">
                      <BookOpen className="h-5 w-5 mr-2 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-sm text-muted-foreground">Publisher</p>
                        <p className="font-medium">{book.publisher}</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center">
                    <Globe className="h-5 w-5 mr-2 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-sm text-muted-foreground">Language</p>
                      <p className="font-medium">{formatLanguage(book.language)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Chapter Tree */}
            <div className="md:col-span-2">
              <div className="border rounded-lg overflow-hidden bg-card">
                <div className="p-4 border-b">
                  <h2 className="text-xl font-semibold">Chapters</h2>
                </div>
                <div className="p-4">
                  <ChapterTreeArborist 
                    bookSlug={slug}
                    onSelectChapter={undefined}
                  />
                </div>
              </div>
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
