"use client";

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { ComponentType } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Plus, AlertCircle, CheckCircle2, BookOpen, RefreshCw } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { BooksMenu } from '@/components/books/books-menu';
import dynamic from 'next/dynamic';
import type { ChapterNode } from '@/components/books/chapters/chapter-tree-wrapper';
import { useChapters, useUpdateChapterOrder } from '@/hooks/api/use-chapters';

// Extend the ChapterNode type with additional properties needed by the page
interface ExtendedChapterNode extends Omit<ChapterNode, 'children'> {
  children?: ExtendedChapterNode[];
  bookId?: string;
  content?: string;
  isEditing?: boolean;
  isExpanded?: boolean;
}

interface Book {
  id: string;
  title: string;
  slug: string;
  userId: string;
}

interface ChapterTreeWrapperProps {
  initialData: ChapterNode[];
  onReorder?: (updated: ChapterNode[]) => void;
}

// Dynamic import of drag-drop tree wrapper
const ChapterTreeWrapper = dynamic<ChapterTreeWrapperProps>(
  () => import('@/components/books/chapters/chapter-tree-wrapper') as any,
  { 
    ssr: false, 
    loading: () => <Loader2 className="h-8 w-8 animate-spin" /> 
  }
);

export default function ChaptersPage() {
  const params = useParams();
  const router = useRouter();
  const bookSlug = typeof params?.slug === "string" ? params.slug : "";
  
  const [book, setBook] = useState<Book | null>(null);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);

  // Fetch book data
  useEffect(() => {
    if (!bookSlug) return;
    const fetchBook = async () => {
      try {
        const res = await fetch(`/api/books/by-slug/${bookSlug}`);
        if (!res.ok) throw new Error('Failed to fetch book');
        setBook(await res.json());
      } catch (err) {
        console.error(err);
        toast.error('Failed to load book data');
      }
    };
    fetchBook();
  }, [bookSlug]);

  // Fetch chapters
  const { data: chapters = [], isLoading, isError, error, refetch } = useChapters(book?.id || '');
  const { mutateAsync: updateChapterOrder } = useUpdateChapterOrder(book?.id || '');

  // Process chapters into hierarchical tree
  const processedChapters = useMemo<ExtendedChapterNode[]>(() => {
    if (!chapters.length) return [];
    
    const map: Record<string, ExtendedChapterNode> = {};
    const roots: ExtendedChapterNode[] = [];

    chapters.forEach(ch => {
      map[ch.id] = { ...ch, children: [], bookId: book?.id };
    });

    chapters.forEach(ch => {
      const node = map[ch.id];
      const parentId = ch.parent_chapter_id;
      if (parentId && map[parentId]) {
        map[parentId].children!.push(node);
      } else {
        roots.push(node);
      }
    });

    const sortTree = (nodes: ExtendedChapterNode[]): ExtendedChapterNode[] =>
      nodes
        .sort((a,b) => (a.order ?? 0) - (b.order ?? 0))
        .map(n => ({ ...n, children: n.children ? sortTree(n.children) : [] }));

    return sortTree(roots);
  }, [chapters, book?.id]);

  // Handle saving updated chapter order
  const handleSave = useCallback(async (updatedChapters: ChapterNode[]) => {
    try {
      const updates: Array<{ id: string; order: number; level: number; parent_chapter_id: string | null }> = [];

      const collectUpdates = (nodes: ChapterNode[], parentId: string | null = null, level = 0) => {
        nodes.forEach((node, idx) => {
          updates.push({ id: node.id, order: idx, level, parent_chapter_id: parentId });
          if (node.children?.length) collectUpdates(node.children, node.id, level + 1);
        });
      };

      collectUpdates(updatedChapters);
      await updateChapterOrder(updates);

      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
      toast.success('Chapter order saved');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save chapter order');
      throw err;
    }
  }, [updateChapterOrder]);

  const handleAddChapter = useCallback(() => {
    if (!bookSlug) return;
    router.push(`/dashboard/books/${bookSlug}/chapters/new`);
  }, [bookSlug, router]);

  // Add proper type annotations for the callback functions
  const handleViewChapter = useCallback((chapterId: string) => {
    router.push(`/dashboard/books/${bookSlug}/chapters/${chapterId}`);
  }, [bookSlug, router]);

  const handleEditChapter = useCallback((chapterId: string) => {
    router.push(`/dashboard/books/${bookSlug}/chapters/${chapterId}/edit`);
  }, [bookSlug, router]);

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );

  if (isError) return (
    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-md">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error loading chapters</AlertTitle>
        <AlertDescription>{error instanceof Error ? error.message : 'Unknown error'}</AlertDescription>
      </Alert>
      <div className="mt-4">
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Retry
        </Button>
      </div>
    </div>
  );

  if (!book) return (
    <div className="container mx-auto py-10 px-8 text-center">
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="bg-destructive/10 p-4 rounded-full mb-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Book not found</h2>
        <p className="text-muted-foreground mb-6">The book doesn't exist or you lack permission.</p>
        <Button onClick={() => router.push('/dashboard/books')}>Back to Books</Button>
      </div>
    </div>
  );

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
            <Plus className="mr-2 h-4 w-4" /> Add Chapter
          </Button>
        </div>
      </div>

      <div className="w-full p-8">
        {processedChapters.length > 0 ? (
          <ChapterTreeWrapper 
            initialData={processedChapters.map(ch => ({
              id: ch.id,
              title: ch.title || `Chapter ${ch.order + 1}`,
              children: (ch.children || []).map(child => ({
                id: child.id,
                title: child.title || `Chapter ${child.order + 1}`,
                children: [],
                expanded: false,
                isDirectory: false,
                disableDrag: false,
                order: child.order || 0,
                level: child.level || 0,
                className: 'chapter-node',
                subtitle: `Order: ${child.order || 0}`,
                book_id: child.book_id || book?.id || '',
                parent_chapter_id: child.parent_chapter_id || null,
                slug: child.slug || `chapter-${child.id.substring(0, 8)}`,
                created_at: child.created_at || new Date().toISOString(),
                updated_at: child.updated_at || new Date().toISOString()
              })) as ChapterNode[],
              expanded: Boolean(ch.isExpanded),
              isDirectory: Boolean(ch.children && ch.children.length > 0),
              order: ch.order || 0,
              level: ch.level || 0,
              disableDrag: false,
              className: 'chapter-node',
              subtitle: `Order: ${ch.order || 0}`,
              book_id: ch.book_id || book?.id || '',
              parent_chapter_id: ch.parent_chapter_id || null,
              slug: ch.slug || `chapter-${ch.id.substring(0, 8)}`,
              created_at: ch.created_at || new Date().toISOString(),
              updated_at: ch.updated_at || new Date().toISOString()
            }))}
            onReorder={(updatedChapters) => {
              // Handle chapter reordering here
              console.log('Chapters reordered:', updatedChapters);
              // You can add your reorder logic here
              // For example: handleChapterReorder(updatedChapters);
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No chapters yet</h3>
            <p className="text-muted-foreground mb-4">Get started by creating your first chapter</p>
            <Button onClick={handleAddChapter}>
              <Plus className="mr-2 h-4 w-4" /> Add Chapter
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