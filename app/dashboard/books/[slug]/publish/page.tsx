'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, FileText, Headphones, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { BooksMenu } from '@/components/books/books-menu';
import { getBookBySlug } from '@/actions/books/get-book-by-slug';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { initiatePublishSession } from '@/actions/publish/initiate-publish-session';
import type { Book } from '@/types/book';

type PublishStatus = 'idle' | 'initializing' | 'ready' | 'publishing' | 'published' | 'error';

type FormatCardProps = {
  title: string;
  description: React.ReactNode; // Changed from string to ReactNode to support JSX
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
  const [publishStatus, setPublishStatus] = useState<PublishStatus>('idle');
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);

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
      description: 'Publish in EPUB format for e-readers',
      icon: <BookOpen className="h-5 w-5" />,
      active: true,
      status: publishStatus === 'published' && selectedFormat === 'ebook' ? 'published' : 'idle'
    },
    {
      id: 'pdf',
      title: 'PDF',
      description: 'Coming soon - Publish as a printable PDF document',
      icon: <FileText className="h-5 w-5" />,
      active: false,
      status: 'coming_soon'
    },
    {
      id: 'audiobook',
      title: 'Audio Book',
      description: 'Coming soon - Create an audio version of your book',
      icon: <Headphones className="h-5 w-5" />,
      active: false,
      status: 'coming_soon'
    },
  ];

  const handlePublish = async (format: string) => {
    if (!book) return;
    
    try {
      setPublishStatus('initializing');
      setSelectedFormat(format);
      
      // Initialize publish session
      const { sessionId } = await initiatePublishSession({
        bookId: book.id,
        format,
        metadata: {
          title: book.title,
          slug: book.slug,
          // Add any additional metadata needed
        }
      });
      
      setPublishStatus('ready');
      
      // Navigate to the format-specific publish page
      router.push(`/dashboard/books/${slug}/publish/${format}/?sessionId=${sessionId}`);
      
    } catch (error) {
      console.error('Error initializing publish session:', error);
      setPublishStatus('error');
      toast.error('Failed to start publishing process', {
        description: error instanceof Error ? error.message : 'Please try again later.'
      });
    }
  };
  
  const getStatusBadge = (status: PublishStatus | string) => {
    switch (status) {
      case 'published':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
            <CheckCircle2 className="h-3 w-3" /> Published
          </span>
        );
      case 'publishing':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
            <Loader2 className="h-3 w-3 animate-spin" /> Publishing...
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">
            <AlertCircle className="h-3 w-3" /> Error
          </span>
        );
      case 'coming_soon':
        return (
          <span className="inline-flex items-center text-xs text-muted-foreground">
            Coming soon
          </span>
        );
      default:
        return null;
    }
  };

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
        {formats.map((format) => {
          const isActive = format.active && publishStatus !== 'publishing';
          const isCurrentFormat = selectedFormat === format.id;
          
          return (
            <div key={format.id} className="relative">
              {format.status === 'coming_soon' && (
                <div className="absolute top-2 right-2">
                  {getStatusBadge('coming_soon')}
                </div>
              )}
              <FormatCard
                title={format.title}
                description={
                  <div className="flex flex-col gap-1">
                    <span>{format.description}</span>
                    {isCurrentFormat && publishStatus === 'publishing' && (
                      <div className="mt-2">
                        {getStatusBadge('publishing')}
                      </div>
                    )}
                  </div>
                }
                icon={format.icon}
                active={isActive}
                onClick={() => isActive && handlePublish(format.id)}
              />
            </div>
          );
        })}
      </div>
      
      {publishStatus === 'error' && (
        <div className="mt-6 p-4 bg-red-50 rounded-lg text-red-700 text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Publishing failed</p>
            <p className="text-xs">There was an error starting the publishing process. Please try again.</p>
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-2 h-8 px-3 text-xs"
              onClick={() => setPublishStatus('idle')}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
