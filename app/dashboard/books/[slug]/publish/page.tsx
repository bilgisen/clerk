'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, FileText, Headphones, Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { BooksMenu } from '@/components/books/books-menu';
import { getBookBySlug } from '@/actions/books/get-book-by-slug';
import type { Book } from '@/types/book';

type FormatCardProps = {
  title: string;
  description: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
};

const FormatCard = ({ title, description, icon, active = true, onClick }: FormatCardProps) => (
  <Card 
    className={`transition-all ${active ? 'hover:shadow-md hover:border-primary/50 cursor-pointer' : 'opacity-50'}`}
    onClick={active ? onClick : undefined}
  >
    <CardHeader className="pb-2">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/20 text-primary">
          {icon}
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </div>
    </CardHeader>
    <CardContent>
      <CardDescription className="text-sm">
        {description}
      </CardDescription>
    </CardContent>
  </Card>
);

export default function PublishPage() {
  const router = useRouter();
  const params = useParams();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug || '';
  const [book, setBook] = useState<Book | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch book data
  useEffect(() => {
    const fetchBook = async () => {
      if (!slug) return;
      
      try {
        setIsLoading(true);
        const bookData = await getBookBySlug(slug);
        setBook(bookData);
      } catch (error) {
        console.error('Error fetching book:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBook();
  }, [slug]);

  const formats = [
    {
      id: 'ebook',
      title: 'E-book',
      description: 'Publish in EPUB and MOBI formats for e-readers',
      icon: <BookOpen className="h-5 w-5" />,
      active: true
    },
    {
      id: 'pdf',
      title: 'PDF',
      description: 'Coming soon - Publish as a printable PDF document',
      icon: <FileText className="h-5 w-5" />,
      active: false
    },
    {
      id: 'audiobook',
      title: 'Audio Book',
      description: 'Coming soon - Create an audio version of your book',
      icon: <Headphones className="h-5 w-5" />,
      active: false
    },
  ];

  return (
    <div className="p-8 w-full mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">Publish Your Book</h1>
          <p className="text-muted-foreground">
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading book details...
              </span>
            ) : book ? (
              `Publishing: ${book.title}`
            ) : (
              'Choose a format to publish your book'
            )}
          </p>
        </div>
        <BooksMenu slug={slug} bookId={book?.id || ''} />
      </div>
      <Separator className="mb-8" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {formats.map((format) => (
          <div key={format.id}>
            <FormatCard
              title={format.title}
              description={format.description}
              icon={format.icon}
              active={format.active}
              onClick={() => format.active && router.push(`/dashboard/books/${slug}/publish/ebook/`)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
