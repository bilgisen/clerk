"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft, Edit, Plus } from "lucide-react";

interface Chapter {
  id: string;
  title: string;
  content: string;
  parent_chapter_id: string | null;
  order: number;
  level: number;
  created_at: string;
  updated_at: string;
  book_id: string;
  user_id: string;
}

interface ChapterWithChildren extends Chapter {
  children?: ChapterWithChildren[];
}

interface Book {
  id: string;
  title: string;
  slug: string;
  user_id: string;
}

export default function ChapterDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { userId } = useAuth();
  const bookSlug = params?.slug as string;
  const chapterId = params?.chapterId as string;
  
  const [isLoading, setIsLoading] = useState(true);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [chapters, setChapters] = useState<ChapterWithChildren[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch book and chapter data
  useEffect(() => {
    const fetchData = async () => {
      if (!bookSlug || !chapterId) return;
      
      try {
        setIsLoading(true);
        setError(null);
        
        // First get the book by slug to ensure it exists and user has access
        const bookResponse = await fetch(`/api/books/by-slug/${bookSlug}`);
        
        if (!bookResponse.ok) {
          throw new Error('Book not found or access denied');
        }
        
        const book: Book = await bookResponse.json();
        
        // Fetch the chapter and chapters in parallel
        const [chapterResponse, chaptersResponse] = await Promise.all([
          fetch(`/api/books/by-slug/${bookSlug}/chapters/${chapterId}`),
          fetch(`/api/books/by-slug/${bookSlug}/chapters`)
        ]);
        
        if (!chapterResponse.ok) {
          throw new Error('Chapter not found');
        }
        
        if (!chaptersResponse.ok) {
          throw new Error('Failed to fetch chapters');
        }
        
        const [chapterData, chaptersData] = await Promise.all([
          chapterResponse.json() as Promise<Chapter>,
          chaptersResponse.json() as Promise<ChapterWithChildren[]>
        ]);
        
        setChapter(chapterData);
        
        // Build the chapters tree
        const chaptersMap = new Map<string, ChapterWithChildren>();
        const rootChapters: ChapterWithChildren[] = [];
        
        // First pass: create map of all chapters
        chaptersData.forEach((chapter: Chapter) => {
          chaptersMap.set(chapter.id, { ...chapter, children: [] });
        });
        
        // Second pass: build tree structure
        chaptersMap.forEach((chapter) => {
          if (chapter.parent_chapter_id && chaptersMap.has(chapter.parent_chapter_id)) {
            const parent = chaptersMap.get(chapter.parent_chapter_id);
            if (parent) {
              parent.children = parent.children || [];
              parent.children.push(chapter);
            }
          } else {
            rootChapters.push(chapter);
          }
        });
        
        setChapters(rootChapters);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [bookSlug, chapterId]);
  
  // Flatten chapters for parent lookup
  const flattenChapters = useCallback((chaptersToFlatten: ChapterWithChildren[]): Chapter[] => {
    return chaptersToFlatten.reduce<Chapter[]>((acc, currentChapter) => {
      const { children, ...chapterWithoutChildren } = currentChapter;
      return [
        ...acc, 
        chapterWithoutChildren,
        ...(children ? flattenChapters(children) : [])
      ];
    }, []);
  }, []);

  // Get parent chapter title
  const parentTitle = useMemo(() => {
    if (!chapter?.parent_chapter_id || !chapters.length) return null;
    
    const allChapters = flattenChapters(chapters);
    const parentChapter = allChapters.find((c) => c.id === chapter.parent_chapter_id);
    return parentChapter?.title || null;
  }, [chapter, chapters, flattenChapters]);

  const handleAddChapter = () => {
    if (!bookSlug) return;
    router.push(`/dashboard/books/${bookSlug}/chapters/new`);
  };

  const handleEditChapter = () => {
    if (!bookSlug || !chapterId) return;
    router.push(`/dashboard/books/${bookSlug}/chapters/${chapterId}/edit`);
  };

  const handleBackToChapters = () => {
    if (!bookSlug) return;
    router.push(`/dashboard/books/${bookSlug}/chapters`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading chapter...</span>
      </div>
    );
  }

  if (error || !chapter) {
    return (
      <div className="p-8 text-red-500">
        {error || 'Chapter not found'}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <Button 
              variant="ghost" 
              onClick={handleBackToChapters}
              className="mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Chapters
            </Button>
            <h1 className="text-3xl font-bold">{chapter.title}</h1>
            {parentTitle && (
              <p className="text-sm text-muted-foreground mt-1">
                Parent: {parentTitle}
              </p>
            )}
          </div>
          
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleEditChapter}
              disabled={!userId}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Chapter
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleAddChapter}
              disabled={!userId}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Chapter
            </Button>
          </div>
        </div>
        
        <Separator className="my-4" />
      </div>
      
      <div className="prose max-w-none">
        <div dangerouslySetInnerHTML={{ __html: chapter.content || '' }} />
      </div>
    </div>
  );
}