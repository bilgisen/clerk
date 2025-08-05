// app/dashboard/books/[slug]/chapters/page.tsx
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Plus, AlertCircle, RefreshCw, FileText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import dynamic from 'next/dynamic';

// Ensure process.env is typed
declare const process: {
  env: {
    NODE_ENV?: 'development' | 'production' | 'test';
    NEXT_PUBLIC_REVALIDATION_SECRET?: string;
  };
};


type ChapterNode = {
  id: string;
  title: string;
  slug: string;
  order: number;
  level: number;
  parent_chapter_id: string | null;
  book_id: string;
  bookId?: string;
  created_at: string;
  updated_at: string;
  content?: string;
  children?: ChapterNode[];
};

interface Book {
  id: string;
  title: string;
  slug: string;
  userId: string;
}

const ChapterTree = dynamic<{
  chapters: ChapterNode[];
  onSave: (chapters: ChapterNode[]) => Promise<void>;
  onEdit?: (id: string) => void;
  onView?: (id: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
  isSaving?: boolean;
}>(
  () => import('@/components/books/chapters/chapter-tree-wrapper').then((mod) => mod.ChapterTreeWrapper),
  { 
    ssr: false, 
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    ) 
  }
);

export default function ChaptersPage() {
  const params = useParams();
  const router = useRouter();
  const bookSlug = typeof params?.slug === "string" ? params.slug : "";
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<ChapterNode[]>([]);
  
  // Fetch book and chapters data with cache busting
  const fetchData = useCallback(async (force = false) => {
    if (!bookSlug) return;
    
    try {
      setIsLoading(true);
      
      // Add timestamp to bypass cache when forcing refresh
      const timestamp = `?t=${Date.now()}`;
      
      // Fetch book data with cache control headers
      const [bookRes, chaptersRes] = await Promise.all([
        fetch(`/api/books/by-slug/${bookSlug}${timestamp}`, {
          cache: 'no-store',
          next: force ? { tags: [`book-${bookSlug}-chapters`] } : undefined
        }),
        fetch(`/api/books/by-slug/${bookSlug}/chapters${timestamp}`, {
          cache: 'no-store',
          next: force ? { tags: [`book-${bookSlug}-chapters`] } : undefined
        })
      ]);

      if (!bookRes.ok) throw new Error('Failed to fetch book');
      if (!chaptersRes.ok) throw new Error('Failed to fetch chapters');
      
      const [bookData, chaptersData] = await Promise.all([
        bookRes.json(),
        chaptersRes.json()
      ]);
      
      // Process chapters to ensure all required fields are present
      const processedChapters = (chaptersData || []).map((chapter: any) => {
        // Normalize parent_chapter_id and book_id
        const parent_chapter_id = chapter.parent_chapter_id ?? chapter.parentChapterId ?? null;
        const book_id = chapter.book_id ?? chapter.bookId ?? bookData.id ?? '';
        const processedChapter = {
          id: String(chapter.id || ''),
          title: String(chapter.title || 'Untitled Chapter'),
          slug: String(chapter.slug || '').toLowerCase().replace(/\s+/g, '-'),
          book_id,
          parent_chapter_id,
          order: Number(chapter.order) || 0,
          level: Number(chapter.level) || 0,
          created_at: chapter.created_at || new Date().toISOString(),
          updated_at: chapter.updated_at || new Date().toISOString(),
        };
        return processedChapter;
      });
      // Order'a göre sıralama ekle
      processedChapters.sort((a: ChapterNode, b: ChapterNode) => (a.order ?? 0) - (b.order ?? 0));
      // Hiyerarşi oluştur: parent_chapter_id'ye göre children dizisi ekle
      const chapterMap: Record<string, ChapterNode> = {};
      processedChapters.forEach((ch: ChapterNode) => { chapterMap[ch.id] = { ...ch, children: [] }; });
      const rootChapters: ChapterNode[] = [];
      processedChapters.forEach((ch: ChapterNode) => {
        if (ch.parent_chapter_id && chapterMap[ch.parent_chapter_id]) {
          chapterMap[ch.parent_chapter_id].children!.push(chapterMap[ch.id]);
        } else {
          rootChapters.push(chapterMap[ch.id]);
        }
      });
      setBook(bookData);
      setChapters(rootChapters);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load book or chapters');
      setBook(null);
      setChapters([]);
    } finally {
      setIsLoading(false);
    }
  }, [bookSlug]);
  
  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Handle adding a new chapter
  const handleAddChapter = useCallback(() => {
    if (!bookSlug) return;
    router.push(`/dashboard/books/${bookSlug}/chapters/new`);
  }, [bookSlug, router]);
  
  // Handle saving chapter order
  const handleSave = useCallback(async (updatedChapters: ChapterNode[]) => {
    if (!bookSlug || !book) return;
    
    try {
      setIsSaving(true);
      const toastId = toast.loading('Updating chapter order...');
      
      // Create a deep copy of the updated chapters to avoid mutating the original
      const chaptersCopy = JSON.parse(JSON.stringify(updatedChapters));
      
      // Flatten the chapters hierarchy for the API
      const flattenChapters = (chapters: ChapterNode[], parentId: string | null = null, level = 1): Omit<ChapterNode, 'children'>[] => {
        let orderCounter = 1;
        const result: Omit<ChapterNode, 'children'>[] = [];
        
        const walk = (nodes: ChapterNode[], parentId: string | null, level: number) => {
          nodes.forEach((chapter) => {
            const flatChapter = {
              ...chapter,
              order: orderCounter++, // global order
              level: level,
              parent_chapter_id: parentId,
              book_id: book.id,
              updated_at: new Date().toISOString(),
            };
            
            // Remove children before sending to API
            const { children, ...chapterWithoutChildren } = flatChapter;
            
            console.log(`Flattening chapter ${chapter.id}:`, chapterWithoutChildren);
            result.push(chapterWithoutChildren);
            
            if (chapter.children && chapter.children.length > 0) {
              walk(chapter.children, chapter.id, level + 1);
            }
          });
        };
        
        walk(chapters, parentId, level);
        return result;
      };
      
      const flatChapters = flattenChapters(chaptersCopy);
      
      // Log the flattened chapters before sending to the server
      console.log('=== FLATTENED CHAPTERS TO SEND ===');
      console.log(JSON.stringify(flatChapters, null, 2));
      
      // Import and call the update function
      const { updateChapterOrder } = await import('@/actions/books/chapters/update-chapter-order');
      console.log('Calling updateChapterOrder with:', {
        bookSlug,
        chapterCount: flatChapters.length,
        firstChapter: flatChapters[0] ? {
          id: flatChapters[0].id,
          order: flatChapters[0].order,
          level: flatChapters[0].level,
          parent_chapter_id: flatChapters[0].parent_chapter_id,
        } : null
      });
      
      const result = await updateChapterOrder(flatChapters, bookSlug);
      
      if (result.success) {
        // Immediately update the local state with the new order
        setChapters(chaptersCopy);
        
        // Get the public revalidation secret from environment
        const publicSecret = process.env.NEXT_PUBLIC_REVALIDATION_SECRET;
        
        // Invalidate Next.js cache
        const revalidateUrl = new URL('/api/revalidate', window.location.origin);
        revalidateUrl.searchParams.append('tag', `book-${bookSlug}-chapters`);
        
        if (publicSecret) {
          revalidateUrl.searchParams.append('secret', publicSecret);
        }
        
        // Trigger revalidation in the background
        fetch(revalidateUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }).catch(console.error);
        
        // Show success message
        toast.success('Chapter order updated successfully', { id: toastId });
      } else {
        // If update failed, revert to the original order
        await fetchData(true);
        toast.error(result.error || 'Failed to update chapter order', { id: toastId });
      }
    } catch (error) {
      console.error('Error updating chapter order:', error);
      toast.error('An unexpected error occurred while updating chapter order');
    } finally {
      setIsSaving(false);
    }
  }, [bookSlug, book, fetchData]);
  
  // Handle chapter edit
  const handleEdit = useCallback((chapterId: string) => {
    if (!bookSlug) return;
    router.push(`/dashboard/books/${bookSlug}/chapters/${chapterId}/edit`);
  }, [bookSlug, router]);
  
  // Handle chapter view
  const handleView = useCallback((chapterId: string) => {
    if (!bookSlug) return;
    router.push(`/dashboard/books/${bookSlug}/chapters/${chapterId}`);
  }, [bookSlug, router]);
  
  // Handle chapter deletion
  const handleDelete = useCallback(async (chapterId: string) => {
    if (!bookSlug) return;
    
    try {
      const response = await fetch(`/api/books/by-slug/${bookSlug}/chapters/${chapterId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete chapter');
      }
      
      // Refresh the chapters list
      await fetchData();
      toast.success('Chapter deleted successfully');
    } catch (error) {
      console.error('Error deleting chapter:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete chapter');
    }
  }, [bookSlug, fetchData]);
  
  // Handle refresh
  const handleRefresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto py-10 px-8">
        <div className="flex justify-between items-start mb-6">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-muted rounded animate-pulse"></div>
            <div className="h-5 w-64 bg-muted rounded animate-pulse"></div>
          </div>
          <div className="h-10 w-24 bg-muted rounded-md animate-pulse"></div>
        </div>
        <Separator className="my-6" />
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading chapters...</p>
          </div>
        </div>
      </div>
    );
  }
  
  // Book not found state
  if (!book) {
    return (
      <div className="container mx-auto py-10 px-8">
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
          <div className="bg-destructive/10 p-4 rounded-full mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Book not found</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
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
    <div className="container mx-auto py-10 px-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {`Chapters: ${book.title}`}
          </h1>
          <p className="text-muted-foreground">
            Organize your book's chapters with drag and drop
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => fetchData(true)}
            variant="outline"
            size="sm"
            disabled={isLoading || isSaving}
          >
            <Loader2 className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : 'hidden'}`} />
            Refresh
          </Button>
          <Button
            onClick={handleAddChapter}
            disabled={isLoading || isSaving}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Chapter
          </Button>
        </div>
      </div>

      <Separator className="my-4" />

      <ChapterTree
        chapters={chapters}
        onSave={handleSave}
        onEdit={handleEdit}
        onView={handleView}
        onDelete={handleDelete}
        isSaving={isSaving}
        className="h-[calc(100vh-250px)]"
      />
    </div>
  );
}