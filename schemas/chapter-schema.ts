import { z } from "zod";

export const chapterFormSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  parent_chapter_id: z.string().nullable().optional(),
  book_id: z.string().optional(),
  order: z.number().int().nonnegative().optional(),
  level: z.number().int().nonnegative().default(0),
  slug: z.string().optional(),
  is_published: z.boolean().default(false),
  published_at: z.date().nullable().optional(),
});

export type ChapterFormValues = z.infer<typeof chapterFormSchema>;

export const chapterFilterSchema = z.object({
  bookId: z.string().optional(),
  isPublished: z.boolean().optional(),
  search: z.string().optional(),
  parentId: z.string().nullable().optional(),
});

export type ChapterFilterValues = z.infer<typeof chapterFilterSchema>;
