// components/books/simple-chapter-list.tsx
'use client';

import React, { useMemo, useContext, createContext } from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";

// Define the chapter structure based on your API response
interface Chapter {
  id: string;
  title: string;
  order?: number;
  parent_chapter_id?: string | null;
  children?: Chapter[];
  [key: string]: any; // Allow additional properties
}

// Create a context for the chapter map
const ChapterMapContext = createContext<Map<string, Chapter & { children: Chapter[] }>>(new Map());

interface SimpleChapterListProps {
  bookSlug: string;
  bookTitle: string;
}

export function SimpleChapterList({ bookSlug, bookTitle }: SimpleChapterListProps) {
  const { getToken } = useAuth();
  
  const { data, isLoading, error } = useQuery<{
    flat: Chapter[];
    tree: (Chapter & { children: Chapter[] })[];
  }>({
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
        
        const result = await response.json();
        // Return both flat list and tree structure with proper typing
        return {
          flat: (result.flat || []) as Chapter[],
          tree: (result.tree || []) as (Chapter & { children: Chapter[] })[]
        };
      } catch (err) {
        console.error('Error fetching chapters:', err);
        throw err;
      }
    }
  });

  const chapters = data?.flat || [];
  const chapterTree = data?.tree || [];

  const { flatChapters, chapterMap } = useMemo(() => {
    if (!Array.isArray(chapters)) return { flatChapters: [], chapterMap: new Map() };
    
    // Create a map for quick lookup of chapters by ID and build parent-child relationships
    const chapterMap = new Map<string, Chapter & { children: Chapter[] }>();
    
    // First pass: create entries for all chapters
    for (const chapter of chapters) {
      chapterMap.set(chapter.id, {
        ...chapter,
        children: []
      });
    }
    
    // Second pass: build the tree
    // Sort chapters by order
    const sortChapters = (chapters: (Chapter & { children?: Chapter[] })[]): (Chapter & { children: Chapter[] })[] => {
      return [...chapters]
        .sort((a: Chapter, b: Chapter) => (a.order || 0) - (b.order || 0))
        .map((chapter: Chapter) => ({
          ...chapter,
          children: sortChapters(chapter.children || [])
        })) as (Chapter & { children: Chapter[] })[];
    };

    const sortedChapters = sortChapters(chapterTree);
    
    // Create a map of chapter IDs to chapters with their children
    const map = new Map<string, Chapter & { children: Chapter[] }>();
    
    const processChapters = (chapters: (Chapter & { children?: Chapter[] })[], parentId: string | null = null): (Chapter & { children: Chapter[] })[] => {
      return chapters.map(chapter => {
        const chapterWithChildren: Chapter & { children: Chapter[] } = {
          ...chapter,
          children: processChapters(chapter.children || [], chapter.id)
        };
        map.set(chapter.id, chapterWithChildren);
        return chapterWithChildren;
      });
    };
    
    processChapters(sortedChapters);
    
    return {
      flatChapters: sortedChapters,
      chapterMap: map
    };
  }, [chapterTree]);

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

  if (!flatChapters.length) {
    return <div className="text-muted-foreground p-2">No chapters found.</div>;
  }

  return (
    <ChapterMapContext.Provider value={chapterMap}>
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Chapters</h3>
        <div className="space-y-1">
          {flatChapters.map((chapter) => (
            <ChapterItem 
              key={chapter.id} 
              chapter={chapter} 
              level={0} 
            />
          ))}
        </div>
        
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-muted-foreground">Debug Info</summary>
            <pre className="mt-2 p-2 bg-muted/10 rounded text-xs overflow-auto max-h-60">
              {JSON.stringify(flatChapters, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </ChapterMapContext.Provider>
  );
}

interface ChapterItemProps {
  chapter: Chapter & { children?: Chapter[] };
  level: number;
}

function ChapterItem({ chapter, level }: ChapterItemProps) {
  const chapterMap = useContext(ChapterMapContext);
  const hasChildren = Boolean(chapter.children?.length);
  
  return (
    <div className="space-y-1">
      <div 
        className={`p-3 border rounded hover:bg-muted/10 transition-colors ${level > 0 ? 'ml-6' : ''}`}
        style={{ marginLeft: `${level * 1}rem` }}
      >
        <h4 className="font-medium flex items-center">
          {hasChildren && (
            <span className="mr-2 text-muted-foreground">
              {chapter.children?.length}
            </span>
          )}
          {chapter.title}
        </h4>
        <div className="text-xs text-muted-foreground mt-1 grid grid-cols-3 gap-2">
          <div className="truncate" title={chapter.id}>
            <span className="font-mono">#{chapter.order}</span>
          </div>
          <div className="truncate">
            {chapter.parent_chapter_id ? (
              <span className="text-xs bg-muted px-2 py-0.5 rounded">
                Parent: {chapterMap.get(chapter.parent_chapter_id)?.title || 'Unknown'}
              </span>
            ) : (
              <span className="text-muted-foreground/50">Top Level</span>
            )}
          </div>
          <div className="text-right">
            <span className="text-xs bg-muted px-2 py-0.5 rounded">
              {chapter.children ? chapter.children.length : 0} children
            </span>
          </div>
        </div>
      </div>
      
      {hasChildren && (
        <div className="space-y-1">
          {chapter.children?.map((child: Chapter) => (
            <ChapterItem 
              key={child.id} 
              chapter={child} 
              level={level + 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
}