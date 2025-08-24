import { notFound, redirect } from "next/navigation";
import { BooksMenu } from "@/components/books/books-menu";
import { Separator } from "@/components/ui/separator";
import { getBookBySlug } from "@/actions/books/get-book-by-slug";
import { getChaptersByBook } from "@/actions/books/get-chapters-by-book";
import { SimpleChapterList } from "@/components/books/simple-chapter-list";
import type { Book } from "@/types/book";
import { 
  BookOpen, 
  Globe, 
  User, 
  BookText, 
  Calendar, 
  FileText, 
  Hash, 
  Info, 
  Languages, 
  ListOrdered, 
  Tag, 
  List, 
  Tags, 
  Plus 
} from "lucide-react";
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
    <div className="w-full flex flex-col space-y-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {book.title}
        </h1>
        {book.author && (
          <p className="text-muted-foreground">{book.author}</p>
        )}
      </div>
      <div className="flex-shrink-0">
        <BooksMenu 
          slug={slug} 
          bookId={book.id} 
          onDelete={async () => {
            'use server';
            const { deleteBook } = await import('@/actions/books/delete-book');
            return deleteBook(book.id);
          }}
        />
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Book Info */}
          <div className="lg:col-span-1">
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
          </div>
          
          {/* Middle Column - Book Details */}
          <div className="lg:col-span-1 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center">
                <Info className="h-5 w-5 mr-2" />
                Book Details
              </h2>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/books/${slug}/edit`}>
                  Edit Details
                </Link>
              </Button>
            </div>
            
            <div className="space-y-4">
              {book.description && (
                <div className="prose dark:prose-invert max-w-none">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Description</h3>
                  <p className="text-foreground">{book.description}</p>
                </div>
              )}
              
              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-start">
                  <BookText className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Title</p>
                    <p className="text-foreground">{book.title}</p>
                  </div>
                </div>
                
                {book.subtitle && (
                  <div className="flex items-start">
                    <FileText className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Subtitle</p>
                      <p className="text-foreground">{book.subtitle}</p>
                    </div>
                  </div>
                )}
                
                {book.author && (
                  <div className="flex items-start">
                    <User className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Author</p>
                      <p className="text-foreground">{book.author}</p>
                    </div>
                  </div>
                )}
                
                {book.contributor && (
                  <div className="flex items-start">
                    <User className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Contributor</p>
                      <p className="text-foreground">{book.contributor}</p>
                    </div>
                  </div>
                )}
                
                {book.translator && (
                  <div className="flex items-start">
                    <User className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Translator</p>
                      <p className="text-foreground">{book.translator}</p>
                    </div>
                  </div>
                )}
                
                {book.publisher && (
                  <div className="flex items-start">
                    <BookOpen className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Publisher</p>
                      <p className="text-foreground">
                        {book.publisher}
                        {book.publisherWebsite && (
                          <a 
                            href={book.publisherWebsite.startsWith('http') ? book.publisherWebsite : `https://${book.publisherWebsite}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="ml-2 text-blue-500 hover:underline"
                          >
                            (Website)
                          </a>
                        )}
                      </p>
                    </div>
                  </div>
                )}
                
                {book.publishYear && (
                  <div className="flex items-start">
                    <Calendar className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Publication Year</p>
                      <p className="text-foreground">{book.publishYear}</p>
                    </div>
                  </div>
                )}
                
                {book.language && (
                  <div className="flex items-start">
                    <Languages className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Language</p>
                      <p className="text-foreground">{formatLanguage(book.language)}</p>
                    </div>
                  </div>
                )}
                
                {book.isbn && (
                  <div className="flex items-start">
                    <Hash className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">ISBN</p>
                      <p className="text-foreground">{book.isbn}</p>
                    </div>
                  </div>
                )}
                
                {book.genre && (
                  <div className="flex items-start">
                    <Tag className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Genre</p>
                      <p className="text-foreground">
                        {book.genre.split('_').map(word => 
                          word.charAt(0) + word.slice(1).toLowerCase()
                        ).join(' ')}
                      </p>
                    </div>
                  </div>
                )}
                
                {book.series && (
                  <div className="flex items-start">
                    <List className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {book.seriesIndex ? `Series (${book.seriesIndex})` : 'Series'}
                      </p>
                      <p className="text-foreground">{book.series}</p>
                    </div>
                  </div>
                )}
                
                {book.tags && book.tags.length > 0 && (
                  <div className="flex items-start">
                    <Tags className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Tags</p>
                      <div className="flex flex-wrap gap-2">
                        {book.tags.map((tag, index) => (
                          <span 
                            key={index} 
                            className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-ring/10"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Right Column - Chapters */}
          <div className="lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold flex items-center">
                <ListOrdered className="h-5 w-5 mr-2" />
                Chapters
              </h2>
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
              <SimpleChapterList 
                bookSlug={slug}
                bookTitle={book.title}
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
