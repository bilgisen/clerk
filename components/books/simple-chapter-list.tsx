// components/books/simple-chapter-list.tsx
'use client';

import React, { useMemo } from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";

interface SimpleChapterListProps {
  bookSlug: string;
  bookTitle: string;
}

export function SimpleChapterList({ bookSlug, bookTitle }: SimpleChapterListProps) {
  const { getToken } = useAuth();
  
  const { data: chapters = [], isLoading, error } = useQuery({
    queryKey: ['chapters', bookSlug],
    queryFn: async () => {
      try {
        const token = await getToken();
        const response = await fetch(`/api/books/by-slug/${bookSlug}/chapters`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          cache: 'no-store'
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch chapters');
        }
        
        return await response.json();
      } catch (err) {
        console.error('Error fetching chapters:', err);
        throw err;
      }
    }
  });

  const sortedChapters = useMemo(() => {
    if (!Array.isArray(chapters)) return [];
    
    const flatten = (items: any[]): any[] => {
      return items.reduce((acc, item) => {
        const { children, ...rest } = item;
        return [
          ...acc, 
          { ...rest },
          ...(Array.isArray(children) ? flatten(children) : [])
        ];
      }, []);
    };
    
    return flatten(chapters).sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [chapters]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2 p-2 border rounded">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-destructive rounded bg-destructive/10 text-destructive">
        Error loading chapters: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  if (!sortedChapters.length) {
    return <div className="text-muted-foreground p-2">No chapters found.</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Chapters</h3>
      <div className="space-y-3">
        {sortedChapters.map((chapter) => (
          <div key={chapter.id} className="p-3 border rounded hover:bg-muted/10">
            <h4 className="font-medium">{chapter.title}</h4>
            <div className="text-sm text-muted-foreground mt-1 grid grid-cols-3 gap-2">
              <div className="truncate" title={chapter.id}>ID: {chapter.id}</div>
              <div>Order: {chapter.order}</div>
              <div className="truncate" title={chapter.parent_chapter_id || chapter.parentChapterId || ''}>
                Parent: {chapter.parent_chapter_id || chapter.parentChapterId || '-'}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {process.env.NODE_ENV === 'development' && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted-foreground">Debug Info</summary>
          <pre className="mt-2 p-2 bg-muted/10 rounded text-xs overflow-auto max-h-60">
            {JSON.stringify(sortedChapters, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}