// Re-export types from chapter.ts to maintain a single source of truth
export type {
  Chapter,
  ChapterWithRelations,
  ChapterWithChildren,
  ChapterTreeItem,
  ChapterUpdateData
} from './chapter';

// Re-export ChapterNode from dnd.ts to avoid circular dependencies
export type { ChapterNode } from './dnd';
