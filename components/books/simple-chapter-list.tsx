// components/books/simple-chapter-list.tsx
'use client';

import React from 'react';
import { useChaptersBySlug } from "@/hooks/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Chapter } from "@/types/chapter";
import { useAuth } from "@clerk/nextjs";

interface SimpleChapterListProps {
  bookSlug: string;
  bookTitle: string;
}

export function SimpleChapterList({ bookSlug, bookTitle }: SimpleChapterListProps) {
  const { getToken } = useAuth();
  
  const { data: chapters, isLoading, error } = useQuery({
    queryKey: ['chapters', bookSlug],
    queryFn: async () => {
      const token = await getToken();
      const response = await fetch(`/api/books/by-slug/${bookSlug}/chapters`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch chapters');
      }
      return response.json();
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-destructive">Error loading chapters: {error.message}</div>;
  }

  if (!chapters || chapters.length === 0) {
    return <div className="text-muted-foreground">No chapters found for this book.</div>;
  }
  
  // Flatten the chapters if they're in a hierarchical structure
  const sortedChapters = React.useMemo(() => {
    const flatten = (items: any[]): any[] => {
      return items.reduce((acc, item) => {
        const { children, ...rest } = item;
        return [...acc, rest, ...(children ? flatten(children) : [])];
      }, []);
    };
    
    return [...flatten(chapters)].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [chapters]);

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