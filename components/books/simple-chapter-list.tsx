// components/books/simple-chapter-list.tsx
'use client';

import React from 'react';

interface Chapter {
  id: string;
  title: string;
  order: number;
  level?: number;
  parent_chapter_id?: string | null;
  parentChapterId?: string | null;
  children?: Chapter[];
  [key: string]: any;
}

interface SimpleChapterListProps {
  bookTitle: string;
  chapters: Chapter[];
}

// Helper function to flatten the chapter tree
function flattenChapters(chapters: Chapter[]): Chapter[] {
  const result: Chapter[] = [];
  
  function processChapter(chapter: Chapter, level: number = 0) {
    const { children, ...rest } = chapter;
    result.push({
      ...rest,
      level
    });
    
    if (children && children.length > 0) {
      children.forEach(child => processChapter(child, level + 1));
    }
  }
  
  chapters.forEach(chapter => processChapter(chapter, 0));
  return result;
}

export function SimpleChapterList({ bookTitle, chapters }: SimpleChapterListProps) {
  // Flatten the chapters if they're in a hierarchical structure
  const flatChapters = React.useMemo(() => {
    return flattenChapters(chapters);
  }, [chapters]);

  // Sort chapters by order
  const sortedChapters = React.useMemo(() => {
    return [...flatChapters].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [flatChapters]);

  if (sortedChapters.length === 0) {
    return <div className="text-muted-foreground">No chapters found for this book.</div>;
  }

  return (
    <div className="space-y-6">
      {sortedChapters.map((chapter) => (
        <div key={chapter.id} className="border-b pb-4 last:border-b-0 last:pb-0">
          <h4 className="font-medium text-lg mb-1">{chapter.title}</h4>
          <div className="text-sm text-muted-foreground grid grid-cols-3 gap-2">
            <div>ID: {chapter.id}</div>
            <div>Order: {chapter.order}</div>
            <div>Parent: {chapter.parent_chapter_id || chapter.parentChapterId || '-'}</div>
          </div>
        </div>
      ))}
      
      {/* Debug information - hidden by default */}
      <details className="mt-6">
        <summary className="text-sm text-muted-foreground cursor-pointer">Show debug information</summary>
        <div className="mt-2 p-3 bg-muted/10 rounded-md">
          <pre className="text-xs overflow-auto max-h-60">
            {JSON.stringify(sortedChapters, null, 2)}
          </pre>
        </div>
      </details>
    </div>
  );
}