// app/dashboard/books/[slug]/chapters/page.tsx
"use client";

import { ChapterTreeWrapper } from "@/components/chapters/ChapterTree";
import { useChaptersBySlug } from "@/hooks/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Chapter } from "@/types/chapter";
import { useAuth } from "@clerk/nextjs";

interface Book {
  id: string;
  title: string;
  slug: string;
}

export default function ChaptersPage({ params }: { params: { slug: string } }) {
  const { getToken } = useAuth();

  // First, fetch the book data
  const { data: book, isLoading: isLoadingBook, error: bookError } = useQuery({
    queryKey: ["book", params.slug],
    queryFn: async () => {
      const response = await fetch(`/api/books/by-slug/${params.slug}`, {
        headers: {
          'Authorization': `Bearer ${await getToken()}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch book");
      return (await response.json()) as Book;
    },
  });

  // Then fetch chapters for the book
  const { data: chaptersData, isLoading: isLoadingChapters, error: chaptersError } =
    useChaptersBySlug(params.slug);

  const chapters = chaptersData?.map((chapter: Chapter) => ({
    ...chapter,
    order: chapter.order ?? 0,
    level: chapter.level ?? 0,
    parent_chapter_id: chapter.parent_chapter_id ?? null,
  })) || [];

  const isLoading = isLoadingBook || isLoadingChapters;
  const error = bookError || chaptersError;
  
  // Don't show loading state if we already have the book data
  const showLoading = isLoading && !(book && chaptersData);

  if (showLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-8 w-48 mb-4" />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-semibold mb-4">Chapters</h1>
        <div className="text-red-500">
          Error loading {bookError ? "book" : "chapters"}: {error.message}
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-semibold mb-4">Chapters</h1>
        <div>Book not found</div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">{book?.title || 'Chapters'}</h1>
      {!isLoadingChapters && chaptersData && (
        <ChapterTreeWrapper 
          initialChapters={chapters} 
          bookId={book?.id || ''} 
        />
      )}
    </div>
  );
}
