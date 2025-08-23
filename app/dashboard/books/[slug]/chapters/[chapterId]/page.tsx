"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft, Edit } from "lucide-react";
import { useChapter, useChaptersBySlug } from "@/hooks/api/use-chapters";

const LexicalRenderer = dynamic(
  () => import('@/components/editor/lexical-renderer').then((mod) => mod.LexicalRenderer),
  { ssr: false }
);
import type { Chapter } from "@/types/chapter";

// Define ChapterWithChildren locally to match our needs
type ChapterWithChildren = Chapter & {
  children_chapters?: ChapterWithChildren[];
  parent_chapter?: ChapterWithChildren | null;
  book?: {
    title: string;
  };
};

// Type for the base chapter format expected by generateCompleteChapterHTML
type ChapterBase = {
  id: string;
  title: string;
  content: string;
  book_id: string;
  user_id: string;
  parent_chapter_id: string | null;
  order: number;
  level: number;
  excerpt: string;
  is_draft: boolean;
  word_count: number;
  reading_time: number | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  // Add these for compatibility with both formats
  bookId?: string;
  userId?: string;
  parentChapterId?: string | null;
  isDraft?: boolean;
  wordCount?: number;
  readingTime?: number | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  publishedAt?: string | Date | null;
};

interface BookWithChapters {
  id: string;
  userId: string;
  title: string;
  slug: string;
  author: string;
  contributor: string | null;
  translator: string | null;
  subtitle: string | null;
  description: string | null;
  publisher: string | null;
  publisherWebsite: string | null;
  publishYear: number | null;
  isbn: string | null;
  language: string;
  genre: string | null;
  series: string | null;
  seriesIndex: number | null;
  tags: string[] | null;
  coverImageUrl: string | null;
  epubUrl: string | null;
  isPublished: boolean;
  isFeatured: boolean;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  created_at: string;
  updated_at: string;
  chapters: ChapterBase[];
  metadata?: Record<string, any> | null;
}

export default function ChapterDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { userId } = useAuth();
  const bookSlug = params?.slug as string;
  const chapterId = params?.chapterId as string;

  const { data: chapterData, isLoading, error: chapterError } = useChapter(bookSlug, chapterId);
  const { data: chaptersData, isLoading: isChaptersLoading, error: chaptersError } = useChaptersBySlug(bookSlug);

  const [chapter, setChapter] = useState<ChapterWithChildren | null>(null);
  const [bookWithChapters, setBookWithChapters] = useState<BookWithChapters | null>(null);

  // Process chapter and book data when loaded
  useEffect(() => {
    if (chapterData) {
      setChapter(chapterData as unknown as ChapterWithChildren);
    }
  }, [chapterData]);

  useEffect(() => {
    if (chaptersData) {
      // Create a proper BookWithChapters object from the chapters data
      if (chaptersData.length > 0) {
        const firstChapter = chaptersData[0] as any;
        const bookData: BookWithChapters = {
          id: firstChapter.bookId,
          userId: firstChapter.userId,
          title: firstChapter.book?.title || '',
          slug: bookSlug,
          author: firstChapter.book?.author || '',
          contributor: firstChapter.book?.contributor || null,
          translator: firstChapter.book?.translator || null,
          subtitle: firstChapter.book?.subtitle || null,
          description: firstChapter.book?.description || null,
          publisher: firstChapter.book?.publisher || null,
          publisherWebsite: firstChapter.book?.publisherWebsite || null,
          publishYear: firstChapter.book?.publishYear || null,
          isbn: firstChapter.book?.isbn || null,
          language: firstChapter.book?.language || 'en',
          genre: firstChapter.book?.genre || null,
          series: firstChapter.book?.series || null,
          seriesIndex: firstChapter.book?.seriesIndex || null,
          tags: firstChapter.book?.tags || null,
          coverImageUrl: firstChapter.book?.coverImageUrl || null,
          epubUrl: firstChapter.book?.epubUrl || null,
          isPublished: firstChapter.book?.isPublished || false,
          isFeatured: firstChapter.book?.isFeatured || false,
          viewCount: firstChapter.book?.viewCount || 0,
          createdAt: firstChapter.book?.createdAt || new Date(),
          updatedAt: firstChapter.book?.updatedAt || new Date(),
          publishedAt: firstChapter.book?.publishedAt || null,
          created_at: firstChapter.book?.created_at || new Date().toISOString(),
          updated_at: firstChapter.book?.updated_at || new Date().toISOString(),
          chapters: (chaptersData as any[]).map(ch => ({
            id: ch.id,
            title: ch.title,
            content: ch.content || '',
            book_id: ch.bookId || ch.book_id,
            user_id: ch.userId || ch.user_id,
            parent_chapter_id: ch.parentChapterId || ch.parent_chapter_id || null,
            order: ch.order || 0,
            level: ch.level || 0,
            excerpt: ch.excerpt || '',
            is_draft: ch.isDraft || ch.is_draft || false,
            word_count: ch.wordCount || ch.word_count || 0,
            reading_time: ch.readingTime || ch.reading_time || null,
            created_at: ch.createdAt || ch.created_at || new Date().toISOString(),
            updated_at: ch.updatedAt || ch.updated_at || new Date().toISOString(),
            published_at: ch.publishedAt || ch.published_at || null,
            // Add compatibility fields
            bookId: ch.bookId || ch.book_id,
            userId: ch.userId || ch.user_id,
            parentChapterId: ch.parentChapterId || ch.parent_chapter_id || null,
            isDraft: ch.isDraft || ch.is_draft || false,
            wordCount: ch.wordCount || ch.word_count || 0,
            readingTime: ch.readingTime || ch.reading_time || null,
            createdAt: ch.createdAt || ch.created_at || new Date().toISOString(),
            updatedAt: ch.updatedAt || ch.updated_at || new Date().toISOString(),
            publishedAt: ch.publishedAt || ch.published_at || null
          }))
        };
        setBookWithChapters(bookData);
      }
    }
  }, [chaptersData, bookSlug]);

  // Handle loading state
  if (isLoading || isChaptersLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Handle error state
  const errorMessage = chapterError?.message || chaptersError?.message || '';
  if (errorMessage) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 mb-4">
          {errorMessage}
        </p>
        <Button 
          onClick={() => router.push(`/dashboard/books/${bookSlug}`)} 
          variant="ghost" 
          className="mt-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Book
        </Button>
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="p-8 text-center">
        <p>Chapter not found</p>
        <Button 
          onClick={() => router.push(`/dashboard/books/${bookSlug}`)}
          variant="ghost"
          className="mt-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Book
        </Button>
      </div>
    );
  }

  const bookTitle = chapter.book?.title || bookWithChapters?.title || bookSlug;

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              <span className="text-muted-foreground">Chapter: </span> {chapter.title}
            </h1>
            <p className="text-muted-foreground">Book: {bookTitle}</p>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push(`/dashboard/books/${bookSlug}/chapters/${chapterId}/edit`)}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push(`/dashboard/books/${bookSlug}`)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Book
            </Button>
          </div>
        </div>
      </div>

      <Separator className="my-6" />

      <div className="prose dark:prose-invert max-w-none">
        {chapter.content ? (
          typeof chapter.content === 'string' && (chapter.content.startsWith('{') || chapter.content.startsWith('[')) ? (
            <LexicalRenderer content={chapter.content} />
          ) : (
            <div dangerouslySetInnerHTML={{ __html: chapter.content }} />
          )
        ) : (
          <p className="text-muted-foreground italic">No content available</p>
        )}
      </div>
    </div>
  );
}
