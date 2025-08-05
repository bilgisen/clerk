// actions/books/chapters/rst-chapter-tree.tsx
'use server';

import { db } from '@/db/drizzle';
import { eq } from 'drizzle-orm';
import { chapters } from '@/db/schema';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';

// Validation schema for the request body
const UpdateChaptersOrderSchema = z.object({
  chapters: z.array(
    z.object({
      id: z.string().uuid(),
      order: z.number().int().nonnegative(),
      level: z.number().int().nonnegative(),
      parentChapterId: z.string().uuid().nullable(),
    })
  ),
});

export async function updateChapterOrder(
  bookSlug: string,
  chaptersData: z.infer<typeof UpdateChaptersOrderSchema>['chapters']
) {
  try {
    const session = await auth();
    const userId = session?.userId;
    if (!userId) {
      return { 
        success: false, 
        error: 'Unauthorized',
        status: 401
      };
    }

    if (!bookSlug) {
      return { 
        success: false, 
        error: 'Book slug is required',
        status: 400
      };
    }

    // First, get the book by slug to verify ownership
    const book = await db.query.books.findFirst({
      where: (books, { eq }) => eq(books.slug, bookSlug),
      columns: { id: true, userId: true }
    });

    if (!book) {
      return { 
        success: false, 
        error: 'Book not found',
        status: 404
      };
    }

    // Verify book ownership
    if (book.userId !== userId) {
      return { 
        success: false, 
        error: 'Access denied',
        status: 403
      };
    }

    // Validate the chapters data
    const validation = UpdateChaptersOrderSchema.safeParse({ chapters: chaptersData });
    if (!validation.success) {
      return { 
        success: false, 
        error: 'Invalid chapters data',
        details: validation.error.issues,
        status: 400
      };
    }

    const { chapters: chaptersToUpdate } = validation.data;
    const chapterIds = chaptersToUpdate.map(ch => ch.id);

    // Verify all chapters belong to this book
    const existingChapters = await db.query.chapters.findMany({
      where: (chapters, { and, eq, inArray }) => 
        and(
          eq(chapters.bookId, book.id),
          inArray(chapters.id, chapterIds)
        ),
      columns: {
        id: true
      }
    });

    if (existingChapters.length !== chapterIds.length) {
      return { 
        success: false, 
        error: 'One or more chapters not found',
        status: 404
      };
    }

    // Update chapters one by one
    for (const chapter of chaptersToUpdate) {
      await db.update(chapters)
        .set({
          order: chapter.order,
          parentChapterId: chapter.parentChapterId || null,
          level: chapter.level,
          updatedAt: new Date(),
        })
        .where(eq(chapters.id, chapter.id));
    }
    
    // Revalidate the chapters page
    revalidatePath(`/dashboard/books/${bookSlug}/chapters`);
    
    return { 
      success: true,
      message: 'Chapter order updated successfully',
      status: 200
    };
    
  } catch (error) {
    console.error('Error updating chapter order:', error);
    return { 
      success: false, 
      error: 'Failed to update chapter order',
      status: 500
    };
  }
}
