'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { chapters, books } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

type ChapterUpdate = {
  id: string;
  order: number;
  level: number;
  parentChapterId: string | null;
  bookId: string;
};
import { z } from 'zod';

// Define the response type
interface UpdateChapterOrderResponse {
  success: boolean;
  message?: string;
  error?: string;
  status: number;
  details?: unknown;
}

// Validation schema for chapter updates
const chapterUpdateSchema = z.object({
  id: z.string().uuid(),
  order: z.number().int().nonnegative(),
  level: z.number().int().nonnegative(),
  parentChapterId: z.string().uuid().nullable(),
  bookId: z.string().uuid(),
});

// Validation schema for the request body
const UpdateChaptersOrderSchema = z.object({
  id: z.string().uuid(),
  order: z.number().int().nonnegative(),
  level: z.number().int().nonnegative(),
  parentChapterId: z.string().uuid().nullable(),
  bookId: z.string().uuid(),
});

export async function updateChapterOrder(
  updatedChapters: unknown,
  bookSlug: string
): Promise<UpdateChapterOrderResponse> {
  try {
    // Get user ID from Clerk
    const { userId } = await auth();
    if (!userId) {
      return { 
        success: false, 
        error: 'Unauthorized',
        status: 401
      };
    }

    // Validate input
    if (!Array.isArray(updatedChapters) || updatedChapters.length === 0) {
      return { 
        success: false, 
        error: 'No chapters provided',
        status: 400
      };
    }

    // LOG: Gelen chapters
    console.log('Gelen chapters:', updatedChapters);

    // Snake_case -> camelCase dönüşümü
    const camelizedChapters = (updatedChapters as any[]).map(ch => ({
      ...ch,
      bookId: ch.book_id,
      parentChapterId: ch.parent_chapter_id,
    }));

    // Validate each chapter
    const validationResults = z.array(UpdateChaptersOrderSchema).safeParse(camelizedChapters);
    if (!validationResults.success) {
      console.error('Validation error:', validationResults.error.flatten());
      return {
        success: false,
        error: 'Invalid chapter data',
        details: validationResults.error.flatten(),
        status: 400
      };
    }
    
    const validChapters = validationResults.data;

    // Get the book by slug to verify ownership
    const book = await db.query.books.findFirst({
      where: (books, { eq }) => eq(books.slug, bookSlug),
      columns: { 
        id: true, 
        userId: true 
      }
    });

    if (!book) {
      return { 
        success: false, 
        error: 'Book not found or access denied',
        status: 404
      };
    }

    // Log the incoming data for debugging
    console.log('=== START: Chapter Update Request ===');
    console.log('Book ID:', book.id);
    console.log('Book Slug:', bookSlug);
    console.log('Chapters to update:', JSON.stringify(validChapters, null, 2));
    
    // Start a transaction for atomic updates
    const result = await db.transaction(async (tx) => {
      const results: ChapterUpdate[] = [];
      
      // First, verify all chapters belong to this book
      const chapterIds = validChapters.map(ch => ch.id);
      console.log('\n=== Verifying Chapter Ownership ===');
      console.log('Expected Chapters:', chapterIds);
      
      const existingChapters = await tx
        .select({ 
          id: chapters.id,
          bookId: chapters.bookId,
        })
        .from(chapters)
        .where(
          and(
            inArray(chapters.id, chapterIds),
            eq(chapters.bookId, book.id)
          )
        );

      if (existingChapters.length !== validChapters.length) {
        const missingChapters = chapterIds.filter(
          id => !existingChapters.some(ch => ch.id === id)
        );
        console.error('Missing chapters:', missingChapters);
        throw new Error(`One or more chapters not found: ${missingChapters.join(', ')}`);
      }
      
      // Use direct SQL for updates to avoid any ORM mapping issues
      for (const chapter of validChapters) {
        console.log('\n=== Processing Chapter Update ===');
        console.log('Update öncesi:', chapter);
        const updateResult = await tx.execute(sql`
          UPDATE chapters 
          SET 
            "order" = ${chapter.order},
            level = ${chapter.level},
            parent_chapter_id = ${chapter.parentChapterId},
            updated_at = NOW()
          WHERE id = ${chapter.id}
          RETURNING id, "order" as order, level, parent_chapter_id, book_id
        `);
        // Type assertion for the update result
        const updatedChapter = updateResult[0] as ChapterUpdate;
        console.log('Update sonrası:', updatedChapter);
        results.push(updatedChapter);
      }

      // Verify the updates were applied
      const updatedChaptersDb = await db.query.chapters.findMany({
        where: (ch, { inArray, eq }) => 
          and(
            inArray(ch.id, chapterIds),
            eq(ch.bookId, book.id)
          ),
        columns: {
          id: true,
          bookId: true,
          order: true,
          level: true,
          parentChapterId: true
        }
      });
      console.log('DB güncel chapters:', updatedChaptersDb);

      if (updatedChaptersDb.length !== validChapters.length) {
        const missingChapters = chapterIds.filter(
          id => !updatedChaptersDb.some(ch => ch.id === id)
        );
        console.error('Failed to update chapters:', missingChapters);
        throw new Error(`Failed to update chapters: ${missingChapters.join(', ')}`);
      }
      
      // Return the results to be committed
      return validChapters;
    });
    
    console.log('Transaction completed successfully. Results:', result);

    // Revalidate the pages to show updated data
    revalidatePath(`/dashboard/books/${bookSlug}/chapters`);
    revalidatePath(`/dashboard/books/${bookSlug}`);
    
    return { 
      success: true,
      message: 'Chapter order updated successfully',
      status: 200,
      details: result
    };
  } catch (error) {
    console.error('Error updating chapter order:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update chapter order',
      status: 500,
      details: error
    };
  }
}
