"use client";

import { useState, useRef, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ChapterContentForm } from '@/components/books/chapters/chapter-content-form';
import { BooksMenu } from '@/components/books/books-menu';
import type { ChapterFormValues } from '@/schemas/chapter-schema';

type Chapter = {
  id: string;
  title: string;
  slug: string;
  order: number;
  level: number;
  parent_chapter_id: string | null;
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
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

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
    chapters.forEach((ch) => {
      if (ch.parent_chapter_id) {
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
    if (!chapter) return [];
    return chapters.filter((c) => c.id !== chapter.id && !descendants.has(c.id)).map(ch => ({
      id: ch.id,
      title: ch.title,
      level: ch.level,
      parent_chapter_id: ch.parent_chapter_id
    }));
  }, [chapters, chapter, descendants]);

  const handleSubmit = async (data: ChapterFormValues): Promise<{ success: boolean; redirectUrl?: string }> => {
    if (!chapter || !userId) {
      setFormError("Authentication required");
      return { success: false };
    }
    
    setIsSubmitting(true);
    setFormError(null);

    try {
      const token = await getToken();
      const parentId = data.parent_chapter_id || null;
      const parent = parentId ? chapters.find((c) => c.id === parentId) : null;
      const level = parent ? (parent.level || 0) + 1 : 0;

      const response = await fetch(`/api/books/by-slug/${bookSlug}/chapters/${chapterId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: data.title,
          content: data.content,
          book_id: chapter.book_id,
          user_id: userId,
          parent_chapter_id: parentId,
          parentId: parentId, // Include both for backward compatibility
          order: chapter.order || 0,
          level,
          updated_at: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update chapter');
      }

      toast.success('Chapter updated successfully');
      router.push(`/dashboard/books/${bookSlug}/chapters`);
      return { success: true };
    } catch (error) {
      console.error('Error updating chapter:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update chapter. Please try again.';
      setFormError(errorMessage);
      toast.error('Failed to update chapter');
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
            <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => router.back()}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Edit Chapter</h1>
              <p className="text-sm text-muted-foreground">{chapter.title}</p>
            </div>
          </div>
          </div>
          <BooksMenu 
            slug={bookSlug}
            onView={() => router.push(`/dashboard/books/${bookSlug}/chapters/${chapterId}`)}
          />
        </div>

        <Separator />

        <ChapterContentForm
          ref={formRef}
          onSubmit={handleSubmit}
          initialData={{
            title: chapter.title,
            content: chapter.content,
            parent_chapter_id: chapter.parent_chapter_id || null,
            book_id: chapter.book_id,
            id: chapter.id,
            level: chapter.level,
            order: chapter.order,
            slug: chapter.slug,
          }}
          parentChapters={parentChapters}
          loading={isSubmitting}
          bookSlug={bookSlug}
          currentChapterId={chapterId}
        />

        {formError && (
          <div className="mt-4 p-4 text-sm text-destructive bg-destructive/10 rounded-md">
            {formError}
          </div>
        )}
      </div>
    </div>
  );
}
