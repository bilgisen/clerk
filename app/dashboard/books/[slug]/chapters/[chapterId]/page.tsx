"use client";

import { useMemo, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft, Edit, Plus, Download } from "lucide-react";
import { generateCompleteChapterHTML } from "@/lib/generateChapterHTML";
import { useChapter, useChaptersBySlug } from "@/hooks/api/use-chapters";
import type { Book } from "@/db/schema";
import type { Chapter, ChapterWithChildren } from "@/types/chapter";

// Type for the base chapter format expected by generateCompleteChapterHTML
type ChapterBase = {
  id: string;
  title: string;
  content: string;
  bookId: string;
  userId: string;
  parentChapterId: string | null;
  order: number;
  level: number;
  excerpt: string;
  isDraft: boolean;
  wordCount: number;
  readingTime: number | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
};

interface BookWithChapters {
  // Core fields
  id: string;
  userId: string;
  title: string;
  slug: string;
  author: string;
  
  // Author Information
  contributor: string | null;
  translator: string | null;
  
  // Optional fields
  subtitle: string | null;
  description: string | null;
  publisher: string | null;
  publisherWebsite: string | null;
  publishYear: number | null;
  isbn: string | null;
  language: string;
  genre: 'FICTION' | 'NON_FICTION' | 'SCIENCE_FICTION' | 'FANTASY' | 'ROMANCE' |
    'THRILLER' | 'MYSTERY' | 'HORROR' | 'BIOGRAPHY' | 'HISTORY' | 'SELF_HELP' |
    'CHILDREN' | 'YOUNG_ADULT' | 'COOKBOOK' | 'TRAVEL' | 'HUMOR' | 'POETRY' |
    'BUSINESS' | 'TECHNOLOGY' | 'SCIENCE' | 'PHILOSOPHY' | 'RELIGION' | 'OTHER' | null;
  series: string | null;
  seriesIndex: number | null;
  tags: string[] | null;
  coverImageUrl: string | null;
  epubUrl: string | null;
  isPublished: boolean;
  isFeatured: boolean;
  viewCount: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  
  // Backward compatibility
  created_at: string;
  updated_at: string;
  
  // Relations - use the base Chapter type for HTML generation
  chapters: ChapterBase[];
  
  // Additional fields
  metadata?: Record<string, any> | null;
}

export default function ChapterDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { userId } = useAuth();
  const bookSlug = params?.slug as string;
  const chapterId = params?.chapterId as string;
  
  // Fetch chapter data using React Query
  const { 
    data: chapterData, 
    isLoading: isChapterLoading, 
    error: chapterError 
  } = useChapter(bookSlug, chapterId);
  
  // Fetch all chapters for the book
  const { 
    data: chaptersData, 
    isLoading: isChaptersLoading, 
    error: chaptersError 
  } = useChaptersBySlug(bookSlug);
  
  // Process chapters data into a tree structure
  const { chapters, chapter } = useMemo(() => {
    if (!chaptersData) return { chapters: [], chapter: null };
    
    // Build the chapters tree
    const chaptersMap = new Map<string, ChapterWithChildren>();
    const rootChapters: ChapterWithChildren[] = [];
    
    // First pass: create map of all chapters
    chaptersData.forEach((chapterData: ChapterWithChildren) => {
      const chapterForMap: ChapterWithChildren = {
        ...chapterData,
        children_chapters: []
      };
      chaptersMap.set(chapterForMap.id, chapterForMap);
    });
    
    // Second pass: build tree structure
    chaptersMap.forEach((chapter: ChapterWithChildren) => {
      if (chapter.parent_chapter_id && chaptersMap.has(chapter.parent_chapter_id)) {
        const parent = chaptersMap.get(chapter.parent_chapter_id);
        if (parent) {
          parent.children_chapters = parent.children_chapters || [];
          parent.children_chapters.push(chapter);
        }
      } else {
        rootChapters.push(chapter);
      }
    });
    
    // Find the current chapter
    const currentChapter = chaptersData.find((c: Chapter) => c.id === chapterId) || null;
    
    return { 
      chapters: rootChapters, 
      chapter: currentChapter as Chapter | null 
    };
  }, [chaptersData, chapterId]);
  
  // Function to convert ChapterWithChildren to ChapterBase
  const convertToChapterBase = (ch: ChapterWithChildren): ChapterBase => ({
    id: ch.id,
    title: ch.title,
    content: ch.content || '',
    bookId: ch.book_id,
    userId: ch.user_id,
    parentChapterId: ch.parent_chapter_id || null,
    order: ch.order || 0,
    level: ch.level || 1,
    excerpt: '',
    isDraft: false,
    wordCount: 0,
    readingTime: null,
    createdAt: new Date(ch.created_at),
    updatedAt: new Date(ch.updated_at),
    publishedAt: null,
  });

  // Get book data from the first chapter if available
  const book = useMemo(() => {
    if (!chapter) return null;
    
    // Get book data from chapter relations if available
    const bookData = chapter as unknown as { book?: { title?: string; slug?: string; author?: string; description?: string; coverImageUrl?: string } };
    
    // Create a book object from chapter data with all required fields
    const now = new Date();
    return {
      // Core fields
      id: chapter.book_id,
      userId: chapter.user_id,
      title: bookData.book?.title || 'Unknown Book',
      slug: bookData.book?.slug || '',
      author: bookData.book?.author || 'Unknown Author',
      
      // Optional fields with defaults
      contributor: null,
      translator: null,
      subtitle: null,
      description: bookData.book?.description || null,
      publisher: null,
      publisherWebsite: null,
      publishYear: null,
      isbn: null,
      language: 'tr',
      genre: null,
      series: null,
      seriesIndex: null,
      tags: null,
      coverImageUrl: bookData.book?.coverImageUrl || null,
      epubUrl: null,
      isPublished: false,
      isFeatured: false,
      viewCount: 0,
      
      // Timestamps
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      
      // Chapters will be populated later
      chapters: []
    };
  }, [chapter]);
  
  // Create a version of the book with properly typed chapters for HTML generation
  const bookWithChapters = useMemo(() => {
    if (!book || !chaptersData) return null;
    
    const flatChapters: ChapterBase[] = [];
    
    // Process chapters and their children recursively
    const processChapters = (chapters: ChapterWithChildren[] = []) => {
      for (const ch of chapters) {
        if (!ch) continue;
        
        const chapterBase: ChapterBase = {
          id: ch.id,
          title: ch.title,
          content: ch.content || '',
          bookId: ch.book_id,
          userId: ch.user_id,
          parentChapterId: ch.parent_chapter_id || null,
          order: ch.order || 0,
          level: ch.level || 1,
          // Provide default values for required fields not in the base Chapter type
          excerpt: '',
          isDraft: false,
          wordCount: 0,
          readingTime: null,
          // Convert string dates to Date objects
          createdAt: new Date(ch.created_at),
          updatedAt: new Date(ch.updated_at),
          publishedAt: null, // Not available in base Chapter type
        };
        
        flatChapters.push(chapterBase);
        
        // Process child chapters if they exist
        if (ch.children_chapters && ch.children_chapters.length > 0) {
          processChapters(ch.children_chapters);
        }
      }
    };
    
    // Start processing from the root chapters
    processChapters(chaptersData);
    
    return {
      ...book,
      chapters: flatChapters
    };
  }, [book, chaptersData]);
  
  // Type for the flattened chapter format expected by generateCompleteChapterHTML
  type FlattenedChapter = {
    id: string;
    title: string;
    content: string;
    bookId: string;
    userId: string;
    parentChapterId: string | null;
    order: number;
    level: number;
    excerpt: string;
    isDraft: boolean;
    wordCount: number;
    readingTime: number | null;
    createdAt: Date;
    updatedAt: Date;
    publishedAt: Date | null;
  };

  // Flatten chapters for parent lookup
  const flattenChapters = useCallback((chaptersToFlatten: ChapterWithChildren[] = []): FlattenedChapter[] => {
    if (!Array.isArray(chaptersToFlatten)) {
      return [];
    }
    
    return chaptersToFlatten.reduce<FlattenedChapter[]>((acc, ch) => {
      if (!ch) return acc;
      
      // Map each chapter to the expected format for generateCompleteChapterHTML
      const mappedChapter: FlattenedChapter = {
        id: ch.id,
        title: ch.title,
        content: ch.content || '',
        bookId: ch.book_id,
        userId: ch.user_id,
        parentChapterId: ch.parent_chapter_id || null,
        order: ch.order || 0,
        level: ch.level || 1,
        // Provide default values for required fields not in the base Chapter type
        excerpt: '',
        isDraft: false,
        wordCount: 0,
        readingTime: null,
        // Convert string dates to Date objects
        createdAt: new Date(ch.created_at),
        updatedAt: new Date(ch.updated_at),
        publishedAt: null, // Not available in base Chapter type
      };
      
      // Process child chapters if they exist
      const childChapters = ch.children_chapters ? flattenChapters(ch.children_chapters) : [];
      
      return [...acc, mappedChapter, ...childChapters];
    }, []);
  }, []);

  // Get parent chapter title
  const parentTitle = useMemo(() => {
    if (!chapter?.parent_chapter_id || !chaptersData?.length) return null;
    const parent = chaptersData.find((c: ChapterWithChildren) => c.id === chapter.parent_chapter_id);
    return parent?.title || null;
  }, [chapter, chaptersData]);

  // Handle export to HTML
  const handleExportHTML = useCallback(() => {
    if (!chapter || !bookWithChapters) return;

    try {
      // Map chapter properties to match the expected format for generateCompleteChapterHTML
      // First create a properly typed object with all required fields
      const formattedChapter = {
        id: chapter.id,
        title: chapter.title,
        content: chapter.content || '',
        bookId: chapter.book_id,
        userId: chapter.user_id,
        parentChapterId: chapter.parent_chapter_id || null,
        order: chapter.order || 0,
        level: chapter.level || 1,
        // Provide default values for required fields
        excerpt: '',
        isDraft: false,
        wordCount: 0,
        readingTime: null,
        // Convert dates
        createdAt: new Date(chapter.created_at),
        updatedAt: new Date(chapter.updated_at),
        publishedAt: null,
      };

      const html = generateCompleteChapterHTML(
        formattedChapter,
        flattenChapters(chapters),
        bookWithChapters
      );

      // Create a blob and download link
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${chapter.title.replace(/\s+/g, '-').toLowerCase()}.html`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 0);
    } catch (error) {
      console.error('Error exporting HTML:', error);
      toast.error('Failed to export chapter as HTML');
    }
  }, [chapter, bookWithChapters, chapters, parentTitle, flattenChapters]);

  // Handle loading and error states
  const isLoading = isChapterLoading || isChaptersLoading;
  const error = chapterError?.message || chaptersError?.message || null;

  // Handle loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4">
        <div className="text-red-500 mb-4">Error loading chapter: {error}</div>
        <Button 
          onClick={() => router.push(`/dashboard/books/${bookSlug}`)} 
          variant="outline"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Book
        </Button>
      </div>
    );
  }

  // Handle missing chapter
  if (!chapter) {
    return (
      <div className="p-8 text-red-500">
        Chapter not found
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => router.push(`/dashboard/books/${bookSlug}`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Book
        </Button>
        
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => router.push(`/dashboard/books/${bookSlug}/chapters/${chapterId}/edit`)}
          >
            <Edit className="mr-2 h-4 w-4" /> Edit
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleExportHTML}
          >
            <Download className="mr-2 h-4 w-4" /> Export HTML
          </Button>
        </div>
      </div>
      
      <div className="prose max-w-none">
        <h1>{chapter.title}</h1>
        {parentTitle && <div className="text-sm text-muted-foreground mb-4">Parent: {parentTitle}</div>}
        <Separator className="my-6" />
        
        <div 
          className="prose max-w-none"
          dangerouslySetInnerHTML={{ __html: chapter.content || '' }}
        />
      </div>
    </div>
  );
}
