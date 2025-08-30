import { db } from '@/db/drizzle';
import { chapters } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { createApiHandler } from '@/lib/utils/api-handler';

// Helper function to standardize API responses
const apiResponse = <T = any>(
  data: T,
  status: number = 200,
  headers: Record<string, string> = { 'Content-Type': 'application/json' }
): Response => {
  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
};

// Schema for chapter ID parameter
const chapterIdSchema = z.object({
  chapterId: z.string().uuid('Invalid chapter ID'),
});

// Schema for updating a chapter
const updateChapterSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  content: z.string().optional(),
  order: z.number().int().min(0).optional(),
  level: z.number().int().min(1).max(6).optional(),
  parent_chapter_id: z.string().uuid('Invalid parent chapter ID').nullable().optional(),
  is_published: z.boolean().optional(),
  slug: z.string().optional(),
  book_id: z.string().uuid('Invalid book ID').optional(),
});

type UpdateChapterInput = z.infer<typeof updateChapterSchema>;

// GET: Get a single chapter by ID
export const GET = createApiHandler({
  paramsSchema: chapterIdSchema,
  async handler({ params }) {
    const { chapterId } = params;
    
    const chapter = await db.query.chapters.findFirst({
      where: eq(chapters.id, chapterId),
    });

    if (!chapter) {
      return apiResponse(
        { error: 'Chapter not found' },
        404
      );
    }

    return apiResponse(chapter);
  },
}).GET;

// PATCH: Update a chapter
export const PATCH = createApiHandler({
  paramsSchema: chapterIdSchema,
  bodySchema: updateChapterSchema,
  async handler({ params, body }) {
    const { chapterId } = params;
    
    const [updatedChapter] = await db
      .update(chapters)
      .set({
        ...body,
        updated_at: new Date(),
      })
      .where(eq(chapters.id, chapterId))
      .returning();

    if (!updatedChapter) {
      return apiResponse(
        { error: 'Chapter not found' },
        404
      );
    }

    return apiResponse(updatedChapter);
  },
}).PATCH;

// DELETE: Delete a chapter
export const DELETE = createApiHandler({
  paramsSchema: chapterIdSchema,
  async handler({ params }) {
    const { chapterId } = params;
    
    const [deletedChapter] = await db
      .delete(chapters)
      .where(eq(chapters.id, chapterId))
      .returning();

    if (!deletedChapter) {
      return apiResponse(
        { error: 'Chapter not found' },
        404
      );
    }

    return apiResponse({ success: true });
  },
}).DELETE;
