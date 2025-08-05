// types/chapter.d.ts
// Remove the import and module declaration, replace with direct interface
interface Chapter {
    id: string;
    title: string;
    content: string;
    order: number;
    level: number;
    parent_chapter_id: string | null;
    parent_chapter?: Chapter;
    children_chapters?: Chapter[];
    footnotes?: Record<string, string>;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
  }
  
  // Export the interface for use in other files
  export type { Chapter };