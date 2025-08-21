// types/dnd.ts

/**
 * Represents a chapter node in the book's table of contents
 */
export interface ChapterNode {
  /** Unique identifier for the chapter */
  id: string;
  /** Title of the chapter */
  title: string;
  /** URL-friendly slug for the chapter */
  slug?: string;
  /** ID of the book this chapter belongs to */
  book_id: string;
  /** ID of the parent chapter, null for top-level chapters */
  parent_chapter_id: string | null;
  /** Alias for parent_chapter_id to match database schema */
  parentChapterId?: string | null;
  /** Display order of the chapter */
  order: number;
  /** Nesting level in the hierarchy (0 for top-level) */
  level: number;
  /** Child chapters */
  children?: ChapterNode[];
  /** Timestamp when the chapter was created */
  created_at?: string;
  /** Timestamp when the chapter was last updated */
  updated_at?: string;
  /** Whether the chapter is currently being edited */
  isEditing?: boolean;
  /** Whether the chapter is currently expanded in the UI */
  isExpanded?: boolean;
  /** Whether the chapter is a draft */
  is_draft?: boolean;
  /** The content of the chapter */
  content?: string;
}

/**
 * Type for updating chapter order and hierarchy
 */
export interface ChapterOrderUpdate {
  /** Chapter ID */
  id: string;
  /** Book ID that the chapter belongs to */
  bookId: string;
  /** New display order */
  order: number;
  /** New nesting level */
  level: number;
  /** ID of the parent chapter, null for top-level */
  parent_chapter_id: string | null;
}
