// components/books/simple-chapter-list.tsx
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Chapter {
  id: string;
  title: string;
  order: number;
  parent_chapter_id: string | null;
}

interface SimpleChapterListProps {
  bookTitle: string;
  chapters: Chapter[];
}

export function SimpleChapterList({ bookTitle, chapters }: SimpleChapterListProps) {
  const sortedChapters = [...chapters].sort((a, b) => a.order - b.order);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Chapters: {bookTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sortedChapters.map((chapter) => (
            <div 
              key={chapter.id}
              className="p-3 border rounded-md bg-muted/10"
              style={{ 
                marginLeft: chapter.parent_chapter_id ? '1.5rem' : '0',
                borderLeft: chapter.parent_chapter_id ? '2px solid #64748b' : 'none'
              }}
            >
              <div className="font-medium">{chapter.title}</div>
              <div className="text-sm text-muted-foreground">
                ID: {chapter.id}
              </div>
              <div className="text-xs text-muted-foreground">
                Order: {chapter.order} | Parent: {chapter.parent_chapter_id || 'None'}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 p-3 bg-muted/20 rounded-md">
          <h4 className="text-sm font-medium mb-2">Raw Data:</h4>
          <pre className="text-xs bg-background p-2 rounded overflow-auto max-h-40">
            {JSON.stringify(sortedChapters, null, 2)}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}