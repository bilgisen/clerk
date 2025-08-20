"use client";

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Plus, AlertCircle, FileText, Folder, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ChapterTree } from "@/components/chapters/ChapterTree";
import { useChapters } from '@/hooks/api/use-chapters';
import type { ChapterNode as DndChapterNode } from '@/types/dnd'; // Import with alias

// Import the shared ChapterNode type
import type { ChapterNode } from '@/types/dnd';

// Type for chapters with children from the API
type ChapterWithChildren = ChapterNode & {
  children_chapters: ChapterWithChildren[];
  parent_chapter?: ChapterNode | null;
};

// Extended node type for the tree component
type ExtendedChapterNode = ChapterNode & {
  children?: ExtendedChapterNode[];
  isEditing?: boolean;
  isExpanded?: boolean;
};

interface Book {
  id: string;
  title: string;
  slug: string;
  userId: string;
}

export default function ChaptersPage() {
  const params = useParams();
  const router = useRouter();
  const bookSlug = typeof params?.slug === "string" ? params.slug : "";
  
  const [book, setBook] = useState<Book | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Fetch chapters data
  const { data: chapters = [], isLoading, isError, error, refetch } = useChapters(book?.id || '');

  // Process chapters into flat list for the tree
  const flattenChapters = useCallback((chapters: ChapterWithChildren[], parentId: string | null = null, level = 0): ExtendedChapterNode[] => {
    return chapters.flatMap((chapter, index) => {
      const node: ExtendedChapterNode = {
        id: chapter.id,
        title: chapter.title,
        book_id: chapter.book_id,
        parent_chapter_id: parentId,
        order: chapter.order ?? index,
        level: level,
        content: chapter.content,
        created_at: chapter.created_at,
        updated_at: chapter.updated_at,
        slug: chapter.slug || '',
        is_draft: chapter.is_draft,
        isEditing: false,
        isExpanded: true,
        children: []
      };

      const children = chapter.children_chapters?.length 
        ? flattenChapters(chapter.children_chapters, chapter.id, level + 1)
        : [];

      return [node, ...children];
    });
  }, []);

  const processedChapters = useMemo(() => {
    if (!chapters.length || !book) return [];
    return flattenChapters(chapters as unknown as ChapterWithChildren[]);
  }, [book, chapters, flattenChapters]);

  const handleAddChapter = useCallback(() => {
    if (!bookSlug) return;
    router.push(`/dashboard/books/${bookSlug}/chapters/new`);
  }, [bookSlug, router]);

  const handleSelectChapter = useCallback((chapterId: string) => {
    setSelectedId(chapterId === selectedId ? undefined : chapterId);
  }, [selectedId]);

  const handleViewChapter = useCallback((chapter: ChapterNode) => {
    router.push(`/dashboard/books/${bookSlug}/chapters/${chapter.id}`);
  }, [bookSlug, router]);

  const handleEditChapter = useCallback((chapter: ChapterNode) => {
    router.push(`/dashboard/books/${bookSlug}/chapters/${chapter.id}/edit`);
  }, [bookSlug, router]);

  interface ChapterUpdate {
    id: string;
    order: number;
    level: number;
    parent_chapter_id: string | null;
  }

  const handleSave = useCallback(async (updates: Array<{
    id: string;
    order: number;
    level: number;
    parent_chapter_id: string | null;
  }>) => {
    if (!book?.id) return;
    
    try {
      setIsSaving(true);
      
      // Send updates to the server
      const response = await fetch(`/api/books/${book.id}/chapters/reorder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        throw new Error('Failed to save chapter order');
      }

      // Refresh the data from the server to ensure consistency
      await refetch();
      
      // Show success message
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
      
    } catch (error) {
      console.error('Error updating chapter order:', error);
      toast.error('Failed to update chapter order');
    } finally {
      setIsSaving(false);
    }
  }, [book?.id, processedChapters, refetch]);

  // Fetch book data
  useEffect(() => {
    if (!bookSlug) return;
    
    const fetchBook = async () => {
      try {
        const res = await fetch(`/api/books/by-slug/${bookSlug}`);
        if (!res.ok) throw new Error('Failed to fetch book');
        const bookData = await res.json();
        setBook(bookData);
      } catch (err) {
        console.error('Error fetching book:', err);
        toast.error('Failed to load book data');
      }
    };
    
    fetchBook();
  }, [bookSlug]);

  if (isLoading || !book) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading chapters</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'An unknown error occurred'}
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{book?.title || 'Chapters'}</h1>
          <p className="text-muted-foreground">
            Organize and manage your book chapters
          </p>
        </div>
        <Button onClick={handleAddChapter}>
          <Plus className="mr-2 h-4 w-4" /> Add Chapter
        </Button>
      </div>

      {showSuccessAlert && (
        <Alert className="mb-6">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Success!</AlertTitle>
          <AlertDescription>
            Chapter order has been saved successfully.
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-md border">
        {processedChapters.length > 0 ? (
          <ChapterTree
            bookId={book.id}
            chapters={processedChapters}
            onSave={handleSave}
            onSelect={handleSelectChapter}
            selectedId={selectedId}
          />
        ) : (
          <div className="p-8 text-center">
            <Folder className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No chapters yet</h3>
            <p className="text-muted-foreground mb-4">
              Get started by adding your first chapter
            </p>
            <Button onClick={handleAddChapter} disabled={!bookSlug || !book}>
              <Plus className="mr-2 h-4 w-4" /> Add Chapter
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}