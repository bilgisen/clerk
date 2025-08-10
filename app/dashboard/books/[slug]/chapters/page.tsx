// app/dashboard/books/[slug]/chapters/page.tsx
"use client";

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Plus, AlertCircle, CheckCircle2, BookOpen, RefreshCw } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { BooksMenu } from '@/components/books/books-menu';
import { useChapters, useUpdateChapterOrder } from '@/hooks/api/use-chapters';
import dynamic from 'next/dynamic';

// Import the ChapterNode type from the canonical source
import type { ChapterNode } from '@/types/dnd';

// Extend the ChapterNode type with any additional fields needed for the UI
type ExtendedChapterNode = ChapterNode & {
  bookId?: string;
  content?: string;
  isEditing?: boolean;
  isExpanded?: boolean;
};

interface Book {
  id: string;
  title: string;
  slug: string;
  userId: string;
}

const ChapterTree = dynamic(
  () => import('@/components/books/chapters/chapter-tree-wrapper').then(mod => mod.ChapterTreeWrapper),
  { ssr: false, loading: () => <Loader2 className="h-8 w-8 animate-spin" /> }
);

export default function ChaptersPage() {
  const params = useParams();
  const router = useRouter();
  const bookSlug = typeof params?.slug === "string" ? params.slug : "";
  
  const [book, setBook] = useState<Book | null>(null);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  
  // Fetch book data
  useEffect(() => {
    const fetchBook = async () => {
      if (!bookSlug) return;
      try {
        const res = await fetch(`/api/books/by-slug/${bookSlug}`);
        if (!res.ok) throw new Error('Failed to fetch book');
        setBook(await res.json());
      } catch (error) {
        console.error('Error fetching book:', error);
        toast.error('Failed to load book data');
      }
    };
    fetchBook();
  }, [bookSlug]);
  
  // Fetch chapters
  const { 
    data: chapters = [], 
    isLoading, 
    isError, 
    error,
    refetch: refetchChapters 
  } = useChapters(book?.id || '');
  
  const { mutateAsync: updateChapterOrder } = useUpdateChapterOrder(book?.id || '');
  
  // Process chapters into tree structure
  const processedChapters = useMemo(() => {
    if (!chapters?.length) return [];
    
    const chapterMap: Record<string, ExtendedChapterNode> = {};
    const rootChapters: ExtendedChapterNode[] = [];
    
    // First pass: create all nodes
    chapters.forEach(chapter => {
      chapterMap[chapter.id] = {
        ...chapter,
        children: [],
        bookId: book?.id,
        created_at: chapter.created_at || new Date().toISOString(),
        updated_at: chapter.updated_at || new Date().toISOString()
      };
    });
    
    // Second pass: build hierarchy
    chapters.forEach(chapter => {
      const node = chapterMap[chapter.id];
      const parentId = chapter.parent_chapter_id;
      
      if (parentId && chapterMap[parentId]) {
        chapterMap[parentId].children = chapterMap[parentId].children || [];
        chapterMap[parentId].children!.push(node);
      } else {
        rootChapters.push(node);
      }
    });
    
    // Sort chapters by order
    const sortChapters = (chapters: ExtendedChapterNode[]): ExtendedChapterNode[] => {
      return [...chapters]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map(chapter => ({
          ...chapter,
          children: chapter.children ? sortChapters(chapter.children) : []
        }));
    };
    
    return sortChapters(rootChapters);
  }, [chapters, book?.id]);
  
  // Handle saving chapter order
  const handleSave = useCallback(async (updatedChapters: ChapterNode[]) => {
    try {
      const updates: Array<{
        id: string;
        order: number;
        level: number;
        parent_chapter_id: string | null;
      }> = [];
      
      const collectUpdates = (nodes: ChapterNode[], parentId: string | null = null, level = 0) => {
        nodes.forEach((node, index) => {
          updates.push({
            id: node.id,
            order: index,
            level,
            parent_chapter_id: parentId
          });
          
          if (node.children?.length) {
            collectUpdates(node.children, node.id, level + 1);
          }
        });
      };
      
      collectUpdates(updatedChapters);
      
      await updateChapterOrder(updates);
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
      toast.success('Chapter order saved');
      
      return updatedChapters;
    } catch (error) {
      console.error('Error saving chapter order:', error);
      toast.error('Failed to save chapter order');
      throw error;
    }
  }, [updateChapterOrder]);
  
  const handleAddChapter = useCallback(() => {
    if (!bookSlug) return;
    router.push(`/dashboard/books/${bookSlug}/chapters/new`);
  }, [bookSlug, router]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  if (isError) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-md">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading chapters</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'An unknown error occurred'}
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button variant="outline" onClick={() => refetchChapters()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }
  
  if (!book) {
    return (
      <div className="container mx-auto py-10 px-8">
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
          <div className="bg-destructive/10 p-4 rounded-full mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Book not found</h2>
          <p className="text-muted-foreground mb-6">
            The book you're looking for doesn't exist or you don't have permission to view it.
          </p>
          <Button onClick={() => router.push('/dashboard/books')}>
            Back to Books
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-6 px-4">
      {showSuccessAlert && (
        <div className="mb-6">
          <Alert>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>Chapter order saved successfully</AlertDescription>
          </Alert>
        </div>
      )}
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{book.title}</h1>
          <p className="text-muted-foreground">Organize and manage your book chapters</p>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={handleAddChapter}>
            <Plus className="mr-2 h-4 w-4" />
            Add Chapter
          </Button>
        </div>
      </div>
      
      <div className="w-full p-8">
        {processedChapters.length > 0 ? (
          <ChapterTree 
            chapters={processedChapters.map(ch => ({
              ...ch,
              // Ensure all required ChapterNode fields are present
              slug: ch.slug || `chapter-${ch.id.substring(0, 8)}`,
              book_id: book.id,
              created_at: ch.created_at || new Date().toISOString(),
              updated_at: ch.updated_at || new Date().toISOString(),
            }))}
            onSave={handleSave}
            onView={(chapterId) => router.push(`/dashboard/books/${bookSlug}/chapters/${chapterId}`)}
            onEdit={(chapterId) => router.push(`/dashboard/books/${bookSlug}/chapters/${chapterId}/edit`)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No chapters yet</h3>
            <p className="text-muted-foreground mb-4">
              Get started by creating your first chapter
            </p>
            <Button onClick={handleAddChapter}>
              <Plus className="mr-2 h-4 w-4" />
              Add Chapter
            </Button>
          </div>
        )}
      </div>
      
      <div className="mt-8">
        <BooksMenu slug={book.slug} />
      </div>
    </div>
  );
}