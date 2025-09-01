// app/dashboard/books/[slug]/chapters/[chapterId]/edit/page.tsx
"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { debounce } from 'lodash';
import toast from "sonner";
import { Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChapterContentForm } from '@/components/books/chapters/chapter-content-form';
import { BooksMenu } from '@/components/books/books-menu';
import type { ChapterFormValues } from '@/schemas/chapter-schema';
import { useChapter, useUpdateChapter } from '@/hooks/useChapter';
import { useChaptersBySlug } from '@/hooks/api/use-chapters';
import type { Chapter } from '@/types/chapter';

export default function EditChapterPage() {
  const router = useRouter();
  const { slug: bookSlug, chapterId } = useParams() as { slug: string; chapterId: string };
  const { getToken, user, isLoading: authLoading } = useAuth();
  
  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/signin?redirect=/dashboard/books/${bookSlug}/chapters/${chapterId}/edit`);
      toast.error('Please sign in to edit this chapter');
    }
  }, [user, authLoading, router, bookSlug, chapterId]);
  
  // Fetch chapter data using the new hook
  const { 
    data: chapter, 
    isLoading: isChapterLoading, 
    error: chapterError 
  } = useChapter(chapterId);
  
  // Fetch all chapters for the book
  const { 
    data: chaptersData = [], 
    isLoading: isChaptersLoading,
    error: chaptersError
  } = useChaptersBySlug(bookSlug);
  
  // Update chapter mutation
  const { mutateAsync: updateChapter, isPending: isUpdating } = useUpdateChapter();
  
  // State management
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  
  // Refs
  const formRef = useRef<HTMLFormElement>(null);
  const formDataRef = useRef<ChapterFormValues | null>(null);
  
  // Debounced autosave function
  const debouncedSave = useCallback(
    debounce(async (data: ChapterFormValues) => {
      if (!chapterId || !chapter) return;
      
      try {
        // Prepare the data for update, mapping form values to API expected format
        const updateData = {
          ...data,
          parent_chapter_id: data.parent_chapter_id || null,
          is_published: data.is_published ?? false,
          // Ensure all required fields are included
          id: chapterId,
          book_id: chapter.book_id,
          user_id: chapter.user_id,
          created_at: chapter.created_at,
          updated_at: new Date().toISOString()
        };
        
        await updateChapter({
          chapterId,
          data: updateData
        });
        
        setLastSaved(new Date());
      } catch (error) {
        console.error('Autosave error:', error);
        toast.error('Failed to autosave chapter');
      } finally {
        setIsSaving(false);
      }
    }, 2000), // 2 second debounce
    [chapterId, updateChapter]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);
  
  // Handle form changes for autosave
  const handleFormChange = useCallback((data: ChapterFormValues) => {
    formDataRef.current = data;
    setIsSaving(true);
    debouncedSave(data);
  }, [debouncedSave]);

  // Handle form submission
  const handleSubmit = async (values: ChapterFormValues): Promise<{ success: boolean; redirectUrl?: string }> => {
    if (!chapterId) return { success: false };
    
    try {
      setIsSaving(true);
      // Prepare the data for update, mapping form values to API expected format
      const updateData = {
        ...values,
        parent_chapter_id: values.parent_chapter_id || null,
        is_published: values.is_published ?? false,
        // Ensure all required fields are included
        id: chapterId,
        book_id: chapter?.book_id || '',
        user_id: chapter?.user_id || ''
      };
      
      await updateChapter({
        chapterId,
        data: updateData
      });
      
      toast.success('Chapter saved successfully');
      setLastSaved(new Date());
      
      return { 
        success: true,
        redirectUrl: `/dashboard/books/${bookSlug}/chapters/${chapterId}`
      };
    } catch (error) {
      console.error('Error saving chapter:', error);
      toast.error('Failed to save chapter');
      return { success: false };
    } finally {
      setIsSaving(false);
    }
  };

  // Set initial form data when chapter loads
  useEffect(() => {
    if (chapter) {
      setLastSaved(new Date(chapter.updated_at));
      // Initialize form data
      // Map chapter data to form values (only include fields defined in ChapterFormValues)
      formDataRef.current = {
        title: chapter.title,
        content: chapter.content || '',
        order: chapter.order,
        level: chapter.level,
        parent_chapter_id: chapter.parent_chapter_id || null,
        is_published: !chapter.is_draft,
        book_id: chapter.book_id,
        slug: chapter.slug,
        // Only include fields that exist in ChapterFormValues
        id: chapter.id,
        // Note: user_id, created_at, and updated_at are not part of ChapterFormValues
        // so they are not included here
      };
    }
  }, [chapter]);

  // Handle loading and error states
  if (isChapterLoading || isChaptersLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (chapterError || chaptersError) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-red-800">
                Error loading chapter data
              </h3>
              <p className="text-sm text-red-700 mt-1">
                {chapterError?.message || chaptersError?.message}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="container mx-auto p-6">
        <p>Chapter not found</p>
      </div>
    );
  }

  // Filter out current chapter and map to expected format for ParentChapterSelect
  const availableParentChapters = useMemo(() => 
    (chaptersData || [])
      .filter((c: Chapter) => c.id !== chapterId)
      .map((ch: Chapter) => ({
        id: ch.id,
        title: ch.title,
        level: ch.level || 0,
        disabled: false
      })),
    [chaptersData, chapterId]
  );

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/dashboard/books/${bookSlug}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Edit Chapter</h1>
        </div>
        <div className="flex items-center space-x-4">
          {isSaving ? (
            <span className="text-sm text-muted-foreground flex items-center">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </span>
          ) : lastSaved ? (
            <span className="text-sm text-muted-foreground">
              Last saved: {lastSaved.toLocaleTimeString()}
            </span>
          ) : null}
          <Button
            type="submit"
            form="chapter-form"
            disabled={isSaving || isUpdating}
          >
            {isUpdating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          {formError && (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded">
              <p className="text-sm text-red-700">{formError}</p>
            </div>
          )}
          
          {chapter && formDataRef.current && (
            <ChapterContentForm
              key={chapter.id}
              initialData={formDataRef.current}
              onChange={handleFormChange}
              onSubmit={handleSubmit}
              loading={isUpdating}
              disabled={isUpdating}
              parentChapters={availableParentChapters}
              currentChapterId={chapterId}
              bookSlug={bookSlug}
              submitButtonText="Save Changes"
            />
          )}
        </div>
        
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-6">
            <BooksMenu slug={bookSlug} bookId={chapter?.book_id || ''} />
            
            <div className="bg-muted p-4 rounded-lg">
              <h3 className="font-medium mb-2">Chapter Details</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Created:</span>{' '}
                  {new Date(chapter.created_at).toLocaleDateString()}
                </div>
                <div>
                  <span className="text-muted-foreground">Last Updated:</span>{' '}
                  {new Date(chapter.updated_at).toLocaleString()}
                </div>
                {chapter.parent_chapter_id && (
                  <div>
                    <span className="text-muted-foreground">Parent Chapter:</span>{' '}
                    {chaptersData.find((c: Chapter) => c.id === chapter.parent_chapter_id)?.title || 'N/A'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
