'use client';

import { useParams } from 'next/navigation';
import { ChapterTreeArborist } from '@/components/chapters/ChapterTreeArborist';

export default function ChapterTreeTestPage() {
  const params = useParams();
  const bookSlug = Array.isArray(params.slug) ? params.slug[0] : params.slug || '';
  
  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Chapter Tree Test</h1>
      <div className="border rounded-lg overflow-hidden">
        <ChapterTreeArborist 
          bookSlug={bookSlug} 
          onSelectChapter={(chapter) => console.log('Selected chapter:', chapter)}
        />
      </div>
    </div>
  );
}
