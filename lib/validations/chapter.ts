import { z } from 'zod';

export const chapterParamsSchema = z.object({
  slug: z.string().min(1, 'Book slug is required'),
  chapterId: z.string().uuid('Invalid chapter ID format'),
});

export const createChapterSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().optional().default(''),
  order: z.number().int().min(0).optional().default(0),
  level: z.number().int().min(1).max(6).optional().default(1),
  parentChapterId: z.string().uuid('Invalid parent chapter ID').nullable().optional(),
  isDraft: z.boolean().optional().default(true),
});

export const updateChapterSchema = createChapterSchema.partial();

export type ChapterParams = z.infer<typeof chapterParamsSchema>;
export type CreateChapterInput = z.infer<typeof createChapterSchema>;
export type UpdateChapterInput = z.infer<typeof updateChapterSchema>;
