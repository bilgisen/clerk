import { Book as DBBook } from '@/db/schema';

export type BookGenre = 'FICTION' | 'NON_FICTION' | 'SCIENCE_FICTION' | 'FANTASY' | 'ROMANCE' |
  'THRILLER' | 'MYSTERY' | 'HORROR' | 'BIOGRAPHY' | 'HISTORY' | 'SELF_HELP' |
  'CHILDREN' | 'YOUNG_ADULT' | 'COOKBOOK' | 'TRAVEL' | 'HUMOR' | 'POETRY' |
  'BUSINESS' | 'TECHNOLOGY' | 'SCIENCE' | 'PHILOSOPHY' | 'RELIGION' | 'OTHER';

export interface Book extends Omit<DBBook, 'userId' | 'createdAt' | 'updatedAt' | 'publishedAt'> {
  // Core fields
  id: string;
  userId: string;
  title: string;
  slug: string;
  author: string;
  
  // Optional fields
  subtitle: string | null;
  description: string | null;
  publisher: string | null;
  publisherWebsite: string | null;
  publishYear: number | null;
  isbn: string | null;
  language: string;
  genre: BookGenre | null;
  series: string | null;
  seriesIndex: number | null;
  tags: string[] | null;
  coverImageUrl: string | null;
  isPublished: boolean;
  isFeatured: boolean;
  viewCount: number;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  created_at: string;
  updated_at: string;
};

// Chapter type
export type Chapter = {
  id: string;
  title: string;
  content: string;
  order: number;
  level: number;
  parentId: string | null;
  bookId: string;
  createdAt: string;
  updatedAt: string;
  // Backward compatibility with snake_case fields
  book_id?: string;
  parent_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

// Book with chapters type
type BookWithChapters = Omit<Book, 'created_at' | 'updated_at'> & {
  chapters: Chapter[];
  // Keep both camelCase and snake_case for backward compatibility
  createdAt: string;
  updatedAt: string;
  created_at?: string;
  updated_at?: string;
  // Alias for cover_image_url
  coverImage?: string | null;
};

export default BookWithChapters;
