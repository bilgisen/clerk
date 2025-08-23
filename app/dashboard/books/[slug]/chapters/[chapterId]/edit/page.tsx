"use client";

import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { debounce } from 'lodash';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ChapterContentForm } from '@/components/books/chapters/chapter-content-form';
import { BooksMenu } from '@/components/books/books-menu';
import type { ChapterFormValues } from '@/schemas/chapter-schema';

interface Chapter {
  id: string;
  title: string;
  slug: string;
  order: number;
  level: number;
  parent_chapter_id?: string | null;
  book_id: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
  content?: string;
};

export default function EditChapterPage() {
  const router = useRouter();
  const { slug: bookSlug, chapterId } = useParams() as { slug: string; chapterId: string };
  const { userId, getToken } = useAuth();
  
  // Debounced autosave function
  const debouncedSave = useCallback(
    debounce(async (data: ChapterFormValues) => {
      if (!chapterId || !bookSlug) return;
      
      try {
        const token = await getToken();
        const response = await fetch(`/api/books/${bookSlug}/chapters/${chapterId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          throw new Error('Failed to autosave chapter');
        }
        
        setLastSaved(new Date());
      } catch (error) {
        console.error('Autosave error:', error);
      } finally {
        setIsSaving(false);
      }
    }, 2000), // 2 second debounce
    [chapterId, bookSlug, getToken]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  
  // Refs
  const formRef = useRef<HTMLFormElement>(null);
  const formDataRef = useRef<ChapterFormValues | null>(null);

  // Fetch chapter and chapters data
  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return;
      
      try {
        setIsLoading(true);
        const token = await getToken();
        
        console.log('Fetching chapter with:', { bookSlug, chapterId });
        // Fetch chapter
        const chapterRes = await fetch(`/api/books/by-slug/${bookSlug}/chapters/${chapterId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (!chapterRes.ok) {
          const errorText = await chapterRes.text();
          console.error('Failed to fetch chapter:', { status: chapterRes.status, errorText });
          throw new Error(`Failed to fetch chapter: ${chapterRes.status} ${errorText}`);
        }
        
        const chapterData = await chapterRes.json();
        console.log('Fetched chapter data:', chapterData);
        setChapter(chapterData);
        
        // Fetch all chapters for the book
        console.log('Fetching all chapters for book:', bookSlug);
        const chaptersRes = await fetch(`/api/books/by-slug/${bookSlug}/chapters`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (!chaptersRes.ok) {
          const errorText = await chaptersRes.text();
          console.error('Failed to fetch chapters:', { status: chaptersRes.status, errorText });
          throw new Error(`Failed to fetch chapters: ${chaptersRes.status} ${errorText}`);
        }
        
        const chaptersData = await chaptersRes.json();
        console.log('Fetched chapters data:', chaptersData);
        setChapters(chaptersData);
        
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load chapter data');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [bookSlug, chapterId, userId, getToken]);

  const childrenMap = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!Array.isArray(chapters)) return map;
    
    chapters.forEach((ch) => {
      if (ch?.parent_chapter_id) {
        map.set(ch.parent_chapter_id, [...(map.get(ch.parent_chapter_id) || []), ch.id]);
      }
    });
    return map;
  }, [chapters]);

  const descendants = useMemo(() => {
    const result = new Set<string>();
    if (!chapter) return result;

    const stack = [chapter.id];
    while (stack.length) {
      const current = stack.pop();
      if (!current) continue;
      const children = childrenMap.get(current) || [];
      children.forEach((child) => {
        if (!result.has(child)) {
          result.add(child);
          stack.push(child);
        }
      });
    }
    return result;
  }, [chapter, childrenMap]);

  const parentChapters = useMemo(() => {
    if (!chapter || !Array.isArray(chapters)) return [];
    return chapters
      .filter((c: Chapter) => c?.id !== chapter?.id && !descendants.has(c.id))
      .map((ch: Chapter) => ({
        id: ch.id,
        title: ch.title,
        level: ch.level,
        parent_chapter_id: ch.parent_chapter_id
      }));
  }, [chapters, chapter, descendants]);

  const handleFormChange = useCallback((data: ChapterFormValues) => {
    formDataRef.current = data;
    if (!isSaving) {
      setIsSaving(true);
      debouncedSave(data);
    }
  }, [debouncedSave, isSaving]);

  const handleSubmit = async (formData: ChapterFormValues): Promise<{ success: boolean; redirectUrl?: string }> => {
    if (!userId) return { success: false };
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      const token = await getToken();
      const response = await fetch(`/api/books/${bookSlug}/chapters/${chapterId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update chapter');
      }

      const updatedChapter = await response.json();
      setChapter(updatedChapter);
      setLastSaved(new Date());
      
      // Show success message and prepare for redirect
      toast.success('Chapter updated successfully', {
        duration: 2000,
        onAutoClose: () => {
          // Redirect after the toast is closed
          router.push(`/dashboard/books/${bookSlug}/chapters/${chapterId}`);
          router.refresh(); // Ensure the latest data is shown
        }
      });
      
      return { 
        success: true,
        redirectUrl: `/dashboard/books/${bookSlug}/chapters/${chapterId}`
      };
    } catch (error) {
      console.error('Error updating chapter:', error);
      setError('Failed to update chapter');
      return { success: false };
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 flex-col space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-muted-foreground">Loading chapter data...</span>
        <div className="text-sm text-muted-foreground">
          <p>Book: {bookSlug}</p>
          <p>Chapter ID: {chapterId}</p>
        </div>
      </div>
    );
  }
  
  if (!chapter) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-medium">Chapter not found</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full mx-auto p-4 md:p-8">
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold"><span className="text-muted-foreground">Edit:</span> {chapter.title}</h1>
              {isSaving ? (
                <span className="text-sm text-muted-foreground">Saving...</span>
              ) : lastSaved ? (
                <span className="text-sm text-muted-foreground">
                  Saved at {lastSaved.toLocaleTimeString()}
                </span>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">Book: {bookSlug}</p>
          </div>
          <BooksMenu 
            slug={bookSlug}
            onView={() => router.push(`/dashboard/books/${bookSlug}/chapters/${chapterId}`)}
          />
        </div>

        <Separator />

        <div className="relative">
          {isSubmitting && (
            <div className="absolute inset-0 bg-background/80 z-10 flex items-center justify-center">
              <div className="flex items-center gap-2 bg-background p-4 rounded-lg shadow-lg border">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span>Saving changes...</span>
              </div>
            </div>
          )}
          <ChapterContentForm
            ref={formRef}
            onSubmit={handleSubmit}
            onChange={handleFormChange}
            initialData={{
              title: chapter.title,
              content: chapter.content || '',
              parent_chapter_id: chapter.parent_chapter_id,
              book_id: chapter.book_id,
              order: chapter.order,
              level: chapter.level,
              slug: chapter.slug,
            }}
            parentChapters={parentChapters}
            loading={isSubmitting}
            bookSlug={bookSlug}
            currentChapterId={chapterId}
          />
        </div>

        {formError && (
          <div className="mt-4 p-4 text-sm text-destructive bg-destructive/10 rounded-md">
            {formError}
          </div>
        )}
      </div>
    </div>
  );
}
