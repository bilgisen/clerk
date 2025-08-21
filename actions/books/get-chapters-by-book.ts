
// actions/books/get-chapters-by-book.ts
"use server";

import { db } from "@/db";
import { auth } from "@clerk/nextjs/server";
import type { ChapterNode } from "@/types/dnd";

/**
 * Fetches all chapters for a specific book, building a hierarchical structure
 * @param bookId - The ID of the book to fetch chapters for
 * @returns A promise that resolves to an array of ChapterNode objects with nested children
 */
export async function getChaptersByBook(bookId: string): Promise<ChapterNode[]> {
  console.log(`[DEBUG] getChaptersByBook called with bookId: ${bookId}`);
  if (!bookId) {
    console.error('No bookId provided to getChaptersByBook');
    return [];
  }

  const session = await auth();
  const userId = session?.userId;
  console.log(`[DEBUG] Session user ID: ${userId || 'none'}`);

  if (!userId) {
    console.error('No user ID in session');
    return [];
  }

  try {
    // First, verify the book belongs to the user
    console.log(`[DEBUG] Verifying book ownership - Book ID: ${bookId}, User ID: ${userId}`);
    const book = await db.query.books.findFirst({
      where: (books, { and, eq }) => and(
        eq(books.id, bookId), 
        eq(books.userId, userId)
      ),
      columns: { id: true },
    });

    if (!book) {
      console.error(`[ERROR] Book not found or permission denied - Book ID: ${bookId}, User ID: ${userId}`);
      throw new Error("Book not found or you don't have permission to view it");
    }

    console.log(`[DEBUG] Fetching chapters for book ID: ${bookId}`);
    // Fetch all chapters for the book with their parent chapter relation
    const dbChapters = await db.query.chapters.findMany({
      where: (chapters, { eq }) => eq(chapters.bookId, bookId),
      with: {
        parentChapter: true,
      },
      orderBy: (chapters, { asc }) => [asc(chapters.order)],
    });
    
    console.log(`[DEBUG] Found ${dbChapters.length} chapters in database`);
    if (dbChapters.length > 0) {
      console.log('[DEBUG] First chapter sample:', {
        id: dbChapters[0].id,
        title: dbChapters[0].title,
        order: dbChapters[0].order,
        parentChapterId: dbChapters[0].parentChapterId,
        hasParentChapter: !!dbChapters[0].parentChapter,
        parentChapter: dbChapters[0].parentChapter
      });
    }

    // Build the chapter hierarchy
    const chapterMap = new Map<string, ChapterNode>();
    const rootChapters: ChapterNode[] = [];

    // First pass: create all chapter nodes with proper ChapterNode type
    for (const dbChapter of dbChapters) {
      // Generate a URL-friendly slug from the title
      const slug = dbChapter.title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-')      // Replace spaces with hyphens
        .replace(/-+/g, '-');      // Replace multiple hyphens with a single one

      const chapter: ChapterNode = {
        id: dbChapter.id,
        title: dbChapter.title,
        book_id: bookId, // Add the required book_id property
        parent_chapter_id: dbChapter.parentChapterId || null,
        order: dbChapter.order || 0,
        level: dbChapter.level || 1,
        slug: slug,
        children: [],
        created_at: dbChapter.createdAt?.toISOString(),
        updated_at: dbChapter.updatedAt?.toISOString()
      };
      chapterMap.set(chapter.id, chapter);
    }

    // Second pass: build the hierarchy and set levels
    for (const chapter of chapterMap.values()) {
      if (chapter.parent_chapter_id && chapterMap.has(chapter.parent_chapter_id)) {
        const parent = chapterMap.get(chapter.parent_chapter_id)!;
        chapter.level = (parent.level || 0) + 1;
        parent.children = parent.children || [];
        parent.children.push(chapter);
      } else {
        chapter.level = 0;
        rootChapters.push(chapter);
      }
    }

    // Sort chapters and their children by order
    const sortChapters = (chapters: ChapterNode[], level = 0): ChapterNode[] => {
      return [...chapters]
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(chapter => ({
          ...chapter,
          level,
          children: chapter.children ? sortChapters(chapter.children, level + 1) : [],
        }));
    };

    return sortChapters(rootChapters);
  } catch (error) {
    console.error('Error fetching chapters:', error);
    return [];
  }
}
