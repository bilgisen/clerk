import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/drizzle';
import { books, chapters } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { z } from 'zod';

// Schema for creating a new chapter
const createChapterSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().optional().default(''),
  order: z.number().int().min(0).optional().default(0),
  level: z.number().int().min(1).max(6).optional().default(1),
  parentChapterId: z.string().uuid('Invalid parent chapter ID').nullable().optional(),
  isDraft: z.boolean().optional().default(true),
});

type CreateChapterInput = z.infer<typeof createChapterSchema>;

// GET: Get all chapters for a specific book
export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;

    // Find the book
    const book = await db.query.books.findFirst({
      where: eq(books.slug, slug),
      columns: { id: true },
    });

    if (!book) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      );
    }

    // Get all chapters for the book
    const bookChapters = await db.query.chapters.findMany({
      where: eq(chapters.bookId, book.id),
      orderBy: [asc(chapters.order), asc(chapters.createdAt)],
    });

    return NextResponse.json(bookChapters);
  } catch (error) {
    console.error('Failed to fetch chapters:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// POST: Create a new chapter for a specific book
export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    
    // Parse and validate request body
    const body = await request.json();
    const validation = createChapterSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.format() },
        { status: 400 }
      );
    }

    // Find the book
    const book = await db.query.books.findFirst({
      where: eq(books.slug, slug),
      columns: { id: true },
    });

    if (!book) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      );
    }

    // Create the new chapter
    const [newChapter] = await db
      .insert(chapters)
      .values({
        ...validation.data,
        bookId: book.id,
      })
      .returning();

    return NextResponse.json(newChapter, { status: 201 });
  } catch (error) {
    console.error('Failed to create chapter:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
