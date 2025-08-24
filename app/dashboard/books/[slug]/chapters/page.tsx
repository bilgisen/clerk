import { notFound, redirect } from "next/navigation";
import { BooksMenu } from "@/components/books/books-menu";
import { Separator } from "@/components/ui/separator";
import { getBookBySlug } from "@/actions/books/get-book-by-slug";
import { getChaptersByBook } from "@/actions/books/get-chapters-by-book";
import { ChapterTreeArborist } from "@/components/chapters/ChapterTreeArborist";
import type { Book } from "@/types/book";
import { BookOpen, Globe, User, BookText, Calendar, FileText, Hash, Info, Languages, ListOrdered, Tag, List, Tags, Plus } from "lucide-react";
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

    // Format language for display
    const formatLanguage = (lang: string | null | undefined) => {
      if (!lang) return 'Not specified';
      return lang === 'tr' ? 'Türkçe' :
             lang === 'en' ? 'English' :
             lang.toUpperCase();
    };
    
    return (
      <div className="container mx-auto w-full p-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content - Chapter Tree */}
          <div className="lg:col-span-3 space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold tracking-tight">
                {book.title} - Chapters
              </h1>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard/books/${slug}/chapters/reorder`}>
                    <ListOrdered className="h-4 w-4 mr-1" />
                    Reorder
                  </Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href={`/dashboard/books/${slug}/chapters/new`}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Chapter
                  </Link>
                </Button>
              </div>
            </div>
            
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
              <div className="p-4">
                <ChapterTreeArborist 
                  bookSlug={slug}
                  onSelectChapter={undefined}
                />
              </div>
            </div>
          </div>
          
          {/* Sidebar - Book Info */}
          <div className="lg:col-span-1">
            <div className="sticky top-4 space-y-6">
              <BookInfo 
                book={{
                  id: book.id,
                  title: book.title,
                  author: book.author,
                  publisher: book.publisher,
                  coverImageUrl: book.coverImageUrl
                }}
                showEditButton
                editHref={`/dashboard/books/${slug}/edit`}
              />
              
              <div className="rounded-lg border bg-card p-4 space-y-4">
                <h3 className="text-lg font-semibold">Quick Actions</h3>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href={`/dashboard/books/${slug}/chapters/new`}>
                      <Plus className="h-4 w-4 mr-2" />
                      New Chapter
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href={`/dashboard/books/${slug}/chapters/reorder`}>
                      <ListOrdered className="h-4 w-4 mr-2" />
                      Reorder Chapters
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href={`/dashboard/books/${slug}/edit`}>
                      <BookOpen className="h-4 w-4 mr-2" />
                      Edit Book Details
                    </Link>
                  </Button>
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
