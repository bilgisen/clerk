// app/dashboard/books/[slug]/page.tsx
import { notFound } from "next/navigation";
import { BooksMenu } from "@/components/books/books-menu";
import { Separator } from "@/components/ui/separator";
import { getBookBySlug } from "@/actions/books/get-book-by-slug";
import type { Book } from "@/types/book";
import { BookInfo } from "@/components/books/book-info";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface PageProps {
  params: { slug: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}

export default async function BookDetailPage({ params, searchParams }: PageProps) {
  try {
    const { slug } = params;
    const bookData = await getBookBySlug(slug);

    if (!bookData) {
      notFound();
    }
    
    const book = bookData as Book & { id: string };

    // Simplified language display
    const formatLanguage = (lang: string | null | undefined) => {
      return lang?.toUpperCase() || 'Not specified';
    };


    // Format book details into fields
    const bookFields = [
      { label: 'Title', value: book.title },
      { label: 'Subtitle', value: book.subtitle },
      { label: 'Author', value: book.author },
      { label: 'Contributor', value: book.contributor },
      { label: 'Publisher', value: book.publisher },
      { 
        label: 'Publication Year', 
        value: book.publishYear ? new Date(book.publishYear).getFullYear() : null 
      },
      { label: 'Language', value: formatLanguage(book.language) },
      { label: 'ISBN', value: book.isbn },
      { label: 'Description', value: book.description, fullWidth: true },
    ].filter(field => field.value !== null && field.value !== undefined && field.value !== '');

    return (
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header Section */}
        <div className="flex flex-col space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{book.title}</h1>
              <p className="text-muted-foreground">
                {book.author}
                {book.publisher && ` • ${book.publisher}`}
              </p>
            </div>
            <BooksMenu slug={slug} bookId={book.id} />
          </div>
          <Separator className="my-4" />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Sidebar - Book Info (1/3) */}
          <div className="lg:col-span-1">
            <BookInfo 
              book={{
                id: book.id,
                title: book.title,
                author: book.author,
                publisher: book.publisher,
                coverImageUrl: book.coverImageUrl
              }}
              showEditButton={false}
              className="sticky top-6"
            />
          </div>

          {/* Right Content - Book Fields (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {bookFields.map((field, index) => (
                <div 
                  key={index} 
                  className={field.fullWidth ? 'md:col-span-2' : ''}
                >
                  <p className="text-sm text-muted-foreground mb-1">
                    {field.label}
                    {field.label === 'Publisher' && book.publisherWebsite && (
                      <a 
                        href={
                          book.publisherWebsite.startsWith('http') 
                            ? book.publisherWebsite 
                            : `https://${book.publisherWebsite}`
                        } 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="ml-2 text-blue-500 hover:underline text-xs"
                      >
                        (Website)
                      </a>
                    )}
                  </p>
                  <p className="text-foreground">
                    {field.value}
                  </p>
                </div>
              ))}
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