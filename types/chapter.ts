// types/chapter.ts

export type Chapter = {
  id: string;
  book_id: string;
  user_id: string;
  title: string;
  content: string;
  parent_chapter_id: string | null;
  order: number;
  level: number;
  created_at: string;
  updated_at: string;
};

export type ChapterWithRelations = Chapter & {
  parent_chapter?: Chapter | null;
  children_chapters?: ChapterWithRelations[];
  book?: {
    id: string;
    title: string;
  };
};

export type ChapterWithChildren = Chapter & {
  children_chapters: ChapterWithChildren[];
  parent_chapter?: Chapter | null;
};

export type ChapterTreeItem = Chapter & {
  children: ChapterTreeItem[];
  parent?: ChapterTreeItem | null;
};

export type ChapterUpdateData = {
  id: string;
  bookId: string;
  userId: string;
  title?: string;
  content?: string;
  order?: number;
  level?: number;
  book_id: string;
  user_id: string;
  parent_chapter_id?: string | null;
  parentId?: string | null; // For backward compatibility
  updated_at?: Date;
};
