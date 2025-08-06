"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft, Edit, Plus, Download } from "lucide-react";
import { generateCompleteChapterHTML, generateChapterHTML } from "@/lib/generateChapterHTML";
import type { Book } from "@/db/schema";

// Chapter data as it comes from the API (with string dates)
interface ApiChapter {
  id: string;
  bookId: string;
  parentChapterId: string | null;
  title: string;
  content: string;
  excerpt: string | null;
  order: number;
  level: number;
  isDraft: boolean;
  wordCount: number;
  readingTime: number | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  children?: ApiChapter[];
}

// Chapter data as used in the component (with Date objects)
interface Chapter {
  id: string;
  bookId: string;
  parentChapterId: string | null;
  title: string;
  content: string;
  excerpt: string | null;
  order: number;
  level: number;
  isDraft: boolean;
  wordCount: number;
  readingTime: number | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  children?: Chapter[];
  // Add missing properties that might be required by generateChapterHTML
  slug?: string;
  parentId?: string | null;
  metadata?: Record<string, any>;
}

// Type for chapters with nested children (API response format)
interface ChapterWithChildren {
  id: string;
  bookId: string;
  parentChapterId: string | null;
  title: string;
  content: string;
  excerpt: string | null;
  order: number;
  level: number;
  isDraft: boolean;
  wordCount: number;
  readingTime: number | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  slug?: string;
  parentId?: string | null;
  metadata?: Record<string, any>;
  children?: ChapterWithChildren[];
}

// Extend the Book type to include chapters
interface BookWithChapters extends Omit<Book, 'chapters'> {
  chapters: Chapter[];
}

export default function ChapterDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { userId } = useAuth();
  const bookSlug = params?.slug as string;
  const chapterId = params?.chapterId as string;
  
  const [isLoading, setIsLoading] = useState(true);
  const [book, setBook] = useState<Book | null>(null);
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
        
        const bookData: Book = await bookResponse.json();
        setBook(bookData);
        
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
        
        const [chapterResponseData, chaptersResponseData] = await Promise.all([
          chapterResponse.json() as Promise<ChapterWithChildren>,
          chaptersResponse.json() as Promise<ChapterWithChildren[]>
        ]);
        
        // Convert API response to Chapter type with proper dates and ensure all required fields
        const chapterData: Chapter = {
          id: chapterResponseData.id,
          bookId: chapterResponseData.bookId,
          parentChapterId: chapterResponseData.parentChapterId,
          title: chapterResponseData.title,
          content: chapterResponseData.content,
          excerpt: chapterResponseData.excerpt || null,
          order: chapterResponseData.order,
          level: chapterResponseData.level,
          isDraft: chapterResponseData.isDraft || false,
          wordCount: chapterResponseData.wordCount || 0,
          readingTime: chapterResponseData.readingTime || null,
          userId: chapterResponseData.userId,
          createdAt: new Date(chapterResponseData.createdAt),
          updatedAt: new Date(chapterResponseData.updatedAt),
          publishedAt: chapterResponseData.publishedAt ? new Date(chapterResponseData.publishedAt) : null
        };
        
        setChapter(chapterData);
        
        // Build the chapters tree
        const chaptersMap = new Map<string, ChapterWithChildren>();
        const rootChapters: ChapterWithChildren[] = [];
        
        // First pass: create map of all chapters
        chaptersResponseData.forEach((chapterData: ChapterWithChildren) => {
          // Create a new object with the correct type for the map
          const chapterForMap: ChapterWithChildren = {
            ...chapterData,
            children: []
          };
          chaptersMap.set(chapterForMap.id, chapterForMap);
        });
        
        // Second pass: build tree structure
        chaptersMap.forEach((chapter: ChapterWithChildren) => {
          if (chapter.parentId && chaptersMap.has(chapter.parentId)) {
            const parent = chaptersMap.get(chapter.parentId);
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
  const flattenChapters = useCallback((chaptersToFlatten: ChapterWithChildren[] = []): Chapter[] => {
    const result: Chapter[] = [];
    
    function processChapter(chapterWithChildren: ChapterWithChildren) {
      const { children, ...chapterData } = chapterWithChildren;
      
      // Create a new Chapter object with proper types and all required properties
      const chapter: Chapter = {
        id: chapterData.id,
        bookId: chapterData.bookId,
        parentChapterId: chapterData.parentChapterId,
        parentId: chapterData.parentChapterId, // Alias for compatibility
        title: chapterData.title,
        content: chapterData.content,
        excerpt: chapterData.excerpt || null,
        order: chapterData.order,
        level: chapterData.level,
        isDraft: chapterData.isDraft || false,
        wordCount: chapterData.wordCount || 0,
        readingTime: chapterData.readingTime || null,
        userId: chapterData.userId,
        // Generate a slug if not provided, using a URL-friendly version of the title or order
        slug: 'slug' in chapterData ? chapterData.slug : `chapter-${chapterData.order || 0}`,
        createdAt: new Date(chapterData.createdAt),
        updatedAt: new Date(chapterData.updatedAt),
        publishedAt: chapterData.publishedAt ? new Date(chapterData.publishedAt) : null,
        children: [],
        metadata: {}
      };
      
      result.push(chapter);
      
      // Process children recursively if they exist
      if (children && children.length > 0) {
        children.forEach(processChapter);
      }
    }
    
    chaptersToFlatten.forEach(processChapter);
    return result;
  }, []);

  // Get parent chapter title
  const parentTitle = useMemo(() => {
    if (!chapter?.parentChapterId || !chapters.length) return null;
    
    // Find the parent chapter by ID in the flattened chapters
    const parent = flattenChapters(chapters).find(ch => ch.id === chapter.parentChapterId);
    return parent?.title || null;
  }, [chapter, chapters]);

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

  const handleExportHTML = useCallback(() => {
    if (!chapter || !chapters || !book) return;
    
    try {
      const flatChapters = flattenChapters(chapters);
      // Create a book object that matches the BookWithChapters interface
      const bookWithChapters: BookWithChapters = {
        id: book.id,
        title: book.title,
        slug: book.slug,
        userId: book.userId,
        author: book.author || '',
        subtitle: book.subtitle || null,
        description: book.description || null,
        publisher: book.publisher || null,
        publisherWebsite: book.publisherWebsite || null,
        publishYear: book.publishYear || null,
        isbn: book.isbn || null,
        language: book.language || 'tr',
        genre: book.genre || null,
        series: book.series || null,
        seriesIndex: book.seriesIndex || null,
        tags: book.tags || null,
        coverImageUrl: book.coverImageUrl || null,
        isPublished: book.isPublished || false,
        isFeatured: book.isFeatured || false,
        viewCount: book.viewCount || 0,
        chapters: flatChapters,
        createdAt: new Date(book.createdAt),
        updatedAt: new Date(book.updatedAt),
        publishedAt: book.publishedAt ? new Date(book.publishedAt) : null
      };

          // Create chapter data with required fields
      const chapterData: Chapter = {
        ...chapter,
        id: chapter.id,
        bookId: chapter.bookId,
        parentChapterId: chapter.parentChapterId || null,
        title: chapter.title,
        content: chapter.content,
        excerpt: chapter.excerpt || null,
        order: chapter.order,
        level: chapter.level,
        isDraft: chapter.isDraft || false,
        wordCount: chapter.wordCount || 0,
        readingTime: chapter.readingTime || null,
        userId: chapter.userId || '',
        createdAt: new Date(chapter.createdAt),
        updatedAt: new Date(chapter.updatedAt)
      };

      // Generate HTML content for the current chapter
      const chapterHTML = generateChapterHTML(chapterData, flatChapters, bookWithChapters);
      
      // Generate complete HTML document
      const fullHTML = generateCompleteChapterHTML(chapterData, flatChapters, bookWithChapters);
      
      // Create a blob and download link
      const blob = new Blob([fullHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${chapter.title.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_').toLowerCase()}.html`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 0);
    } catch (error) {
      console.error('Error exporting HTML:', error);
      setError('Failed to export chapter as HTML');
    }
  }, [chapter, chapters, parentTitle, flattenChapters]);

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
              variant="outline" 
              size="sm" 
              onClick={handleExportHTML}
              disabled={!chapter}
            >
              <Download className="h-4 w-4 mr-2" />
              Export HTML
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