// app/dashboard/books/[slug]/chapters/page.tsx
"use client";

import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { ChapterTreeWrapper } from "@/components/chapters/ChapterTree";
import { useChapters } from "@/hooks/api/use-chapters";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/api";
import { ChapterNode } from "@/types/dnd";

interface Book {
  id: string;
  title: string;
  slug: string;
}

export default function ChaptersPage({ params }: { params: { slug: string } }) {
  // First fetch the book by slug to get its ID
  const { data: book, isLoading: isLoadingBook, error: bookError } = useQuery({
    queryKey: ['book', params.slug],
    queryFn: async () => {
      const response = await fetchWithAuth(`/api/books/by-slug/${params.slug}`);
      if (!response.ok) {
        throw new Error('Failed to fetch book');
      }
      return await response.json() as Book;
    },
  });

  // Then fetch chapters using the book ID
  const { data: chaptersData, isLoading: isLoadingChapters, error: chaptersError } = useChapters(book?.id || '');
  
  // Convert the chapters data to the expected format
  const chapters = chaptersData?.map(chapter => ({
    ...chapter,
    // Ensure all required fields are present
    order: chapter.order || 0,
    level: chapter.level || 0,
    parent_chapter_id: chapter.parent_chapter_id || null,
  })) || [];

  const isLoading = isLoadingBook || (book && isLoadingChapters);
  const error = bookError || chaptersError;

  if (isLoading) {
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
          Error loading {bookError ? 'book' : 'chapters'}: {error.message}
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
      <h1 className="text-xl font-semibold mb-4">Chapters for {book.title}</h1>
      <DndProvider backend={HTML5Backend}>
        <ChapterTreeWrapper initialChapters={chapters} bookId={book.id} />
      </DndProvider>
    </div>
  );
}
