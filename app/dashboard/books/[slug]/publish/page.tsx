'use client';

import { useGetBookBySlug } from '@/queries/books/get-book-by-slug';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileText, BookOpen, FileCode, FileType } from 'lucide-react';


type FormatCardProps = {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
};

const FormatCard = ({ title, description, icon, onClick }: FormatCardProps) => (
  <Card 
    className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50 h-full flex flex-col"
    onClick={onClick}
  >
    <CardHeader className="pb-2">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/20 text-primary">
          {icon}
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </div>
    </CardHeader>
    <CardContent className="flex-1">
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
  
  // Call the hook at the top level, but pass an empty string if slug is undefined
  const { data: bookWithChapters, isLoading, error } = useGetBookBySlug(slug || '');
  
  // If there's no slug, show an error
  if (!slug) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-red-600">
          Book slug is missing from the URL
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !bookWithChapters) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-red-600">
          {error?.message || 'Book not found'}
        </div>
      </div>
    );
  }

  const formats = [
    {
      id: 'epub',
      title: 'EPUB',
      description: 'Standard format for most e-readers and mobile devices',
      icon: <BookOpen className="h-5 w-5" />,
    },
    {
      id: 'mobi',
      title: 'MOBI',
      description: 'Compatible with Amazon Kindle devices',
      icon: <FileText className="h-5 w-5" />,
    },
    {
      id: 'pdf',
      title: 'PDF',
      description: 'Fixed-layout document for printing or digital distribution',
      icon: <FileType className="h-5 w-5" />,
    },
    {
      id: 'html',
      title: 'HTML',
      description: 'Web version of your book',
      icon: <FileCode className="h-5 w-5" />,
    },
    {
      id: 'md',
      title: 'Markdown',
      description: 'Plain text format with simple formatting',
      icon: <FileText className="h-5 w-5" />,
    },
    {
      id: 'doc',
      title: 'Word Document',
      description: 'Editable document for further editing',
      icon: <FileText className="h-5 w-5" />,
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Publish &ldquo;{bookWithChapters.title}&rdquo;</h1>
        <p className="text-muted-foreground">
          Select a format to publish your book
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {formats.map((format) => (
          <div key={format.id} className="h-full">
            <FormatCard
              title={`Publish as ${format.title}`}
              description={format.description}
              icon={format.icon}
              onClick={() => router.push(`/dashboard/books/${slug}/publish/${format.id}`)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
