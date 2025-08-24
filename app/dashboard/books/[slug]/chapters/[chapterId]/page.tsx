//  app/dashboard/books/[slug]/chapters/[chapterId]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Edit, BookOpen, RefreshCw } from "lucide-react";
import { useChapter, useChaptersBySlug } from "@/hooks/api/use-chapters";
import Link from "next/link";

const LexicalRenderer = dynamic(
  () => import('@/components/editor/lexical-renderer').then((mod) => mod.LexicalRenderer),
  { ssr: false }
);

function getPreviewText(content: unknown, max = 200) {
  try {
    if (!content) return "";
    if (typeof content === "string") {
      if (content.trim().startsWith("<")) {
        // HTML ise: tag'leri temizle
        return content.replace(/<[^>]*>?/gm, " ").slice(0, max).trim();
      }
      // Düz string ise direkt kısalt
      return content.slice(0, max).trim();
    }
    // Lexical JSON ise: basitçe text alanlarını toplayalım
    const obj = content as any;
    const s = JSON.stringify(obj);
    // çok basit çıkarım: "text":"..." alanlarını yakala
    const texts = [...s.matchAll(/"text"\s*:\s*"([^"]*)"/g)].map((m) => m[1]);
    return texts.join(" ").slice(0, max).trim();
  } catch {
    return "";
  }
}

export default function ChapterDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { userId } = useAuth();
  const bookSlug = params?.slug as string;
  const chapterId = params?.chapterId as string;
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { 
    data: chapterData, 
    isLoading: isChapterLoading, 
    error: chapterError, 
    refetch: refetchChapter 
  } = useChapter(bookSlug, chapterId, { enabled: !!bookSlug && !!chapterId });
  
  const { 
    data: chaptersData, 
    isLoading: isChaptersLoading, 
    error: chaptersError, 
    refetch: refetchChapters 
  } = useChaptersBySlug(bookSlug, { enabled: !!bookSlug });

  useEffect(() => {
    if (bookSlug && chapterId) {
      setIsLoading(false);
      // Refetch data when params change
      refetchChapter();
      refetchChapters();
    } else {
      setError("Book slug or chapter ID is missing");
      setIsLoading(false);
    }
  }, [bookSlug, chapterId, refetchChapter, refetchChapters]);

  // Show loading state
  if (isLoading || isChapterLoading || isChaptersLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
          <p>Loading chapter...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading chapter</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
              <div className="mt-4">
                <Button
                  variant="outline"
                  onClick={() => router.push(`/dashboard/books/${bookSlug}`)}
                  className="text-sm"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Book
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show API errors
  if (chapterError || chaptersError) {
    const errorMessage = chapterError?.message || chaptersError?.message || 'An unknown error occurred';
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Could not load chapter</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>{errorMessage}</p>
              </div>
              <div className="mt-4 space-x-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (chapterError) refetchChapter();
                    if (chaptersError) refetchChapters();
                  }}
                  className="text-sm"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => router.push(`/dashboard/books/${bookSlug}`)}
                  className="text-sm"
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  View Book
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show not found state
  if (!chapterData) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="text-center">
          <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Chapter not found</h3>
          <p className="mt-1 text-sm text-gray-500">The chapter you're looking for doesn't exist or has been removed.</p>
          <div className="mt-6">
            <Button
              onClick={() => router.push(`/dashboard/books/${bookSlug}`)}
              className="inline-flex items-center"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Book
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Main content
  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/dashboard/books/${bookSlug}/chapters/${chapterId}/edit`)}
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit Chapter
          </Button>
        </div>
      </div>

      <article className="prose dark:prose-invert max-w-none">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">{chapterData.title}</h1>
          {(() => {
            const preview = getPreviewText(chapterData.content);
            return preview ? (
              <div className="hidden text-muted-foreground mt-2 text-lg">
                {preview}
                {preview.length >= 200 ? "…" : ""}
              </div>
            ) : null;
          })()}
        </header>

        <div className="prose-lg dark:prose-invert max-w-none">
          {(() => {
            const contentForRenderer =
              typeof chapterData.content === "string"
                ? chapterData.content
                : chapterData.content
                ? JSON.stringify(chapterData.content)
                : "";

            return contentForRenderer ? (
              <LexicalRenderer content={chapterData.content as any} />
            ) : (
              <div className="text-muted-foreground italic">
                No content available for this chapter.
              </div>
            );
          })()}
        </div>
      </article>

      <div className="mt-12 pt-6 border-t">
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/books/${bookSlug}`)}
          >
            <BookOpen className="mr-2 h-4 w-4" />
            View All Chapters
          </Button>
          <div className="text-sm text-muted-foreground">
            {chapterData.updated_at ? (
              `Last updated: ${new Date(chapterData.updated_at).toLocaleDateString()}`
            ) : (
              `Created: ${new Date(chapterData.created_at).toLocaleDateString()}`
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
