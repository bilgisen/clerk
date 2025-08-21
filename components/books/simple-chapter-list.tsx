// components/books/simple-chapter-list.tsx
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Chapter {
  id: string;
  title: string;
  order: number;
  parent_chapter_id?: string | null;
  parentChapterId?: string | null;
}

interface SimpleChapterListProps {
  bookTitle: string;
  chapters: Chapter[];
}

export function SimpleChapterList({ bookTitle, chapters }: SimpleChapterListProps) {
  // Sort chapters by order
  const sortedChapters = [...chapters].sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Chapters: {bookTitle}</CardTitle>
        <div className="text-sm text-muted-foreground">
          Total: {sortedChapters.length} chapters
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-2 border-b font-medium">Order</th>
                <th className="p-2 border-b font-medium">Title</th>
                <th className="p-2 border-b font-medium">Parent ID</th>
                <th className="p-2 border-b font-medium">ID</th>
              </tr>
            </thead>
            <tbody>
              {sortedChapters.length > 0 ? (
                sortedChapters.map((chapter) => (
                  <tr key={chapter.id} className="border-b hover:bg-muted/10">
                    <td className="p-2">{chapter.order}</td>
                    <td className="p-2 font-medium">{chapter.title}</td>
                    <td className="p-2 text-muted-foreground">
                      {chapter.parent_chapter_id || chapter.parentChapterId || '-'}
                    </td>
                    <td className="p-2 text-muted-foreground text-xs">
                      {chapter.id}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-muted-foreground">
                    No chapters found for this book.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Debug information */}
        <details className="mt-6 border rounded-md overflow-hidden">
          <summary className="bg-muted/50 p-2 px-3 cursor-pointer text-sm font-medium">
            Debug Information
          </summary>
          <pre className="p-3 text-xs bg-background overflow-auto max-h-60 m-0">
            {JSON.stringify(sortedChapters, null, 2)}
          </pre>
        </details>
      </CardContent>
    </Card>
  );
}