'use client';

import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, FileText, Headphones } from 'lucide-react';

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
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Publish Your Book</h1>
        <p className="text-muted-foreground">
          Choose a format to publish your book
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {formats.map((format) => (
          <div key={format.id}>
            <FormatCard
              title={format.title}
              description={format.description}
              icon={format.icon}
              active={format.active}
              onClick={() => format.active && router.push(`/dashboard/books/${slug}/publish/ebook`)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
