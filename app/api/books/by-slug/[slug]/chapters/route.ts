// app/api/books/by-slug/[slug]/chapters/route.ts
import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/db';
import { books, chapters, users } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * GET /api/books/by-slug/[slug]/chapters
 * Get all chapters for a book by slug
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;

  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const [dbUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, user.id))
      .limit(1);

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    const book = await db.query.books.findFirst({
      where: (books, { and, eq }) => and(
        eq(books.slug, slug),
        eq(books.userId, dbUser.id)
      ),
    });

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // First, get all chapters for the book
    const allChapters = await db.query.chapters.findMany({
      where: eq(chapters.bookId, book.id),
      orderBy: [chapters.order],
      columns: {
        id: true,
        bookId: true,
        title: true,
        content: true,
        parentChapterId: true,
        order: true,
        level: true,
        isDraft: true,
        wordCount: true,
        readingTime: true,
        createdAt: true,
        updatedAt: true,
        publishedAt: true
      }
    });

    // Define the chapter type with children
    interface ChapterWithChildren extends Omit<typeof allChapters[number], 'children'> {
      children: ChapterWithChildren[];
    }

    // Then, build the hierarchical structure
    const buildChapterTree = (parentId: string | null = null): ChapterWithChildren[] => {
      return allChapters
        .filter(chapter => 
          (parentId === null && !chapter.parentChapterId) || 
          (chapter.parentChapterId === parentId)
        )
        .map(chapter => ({
          ...chapter,
          children: buildChapterTree(chapter.id)
        }));
    };

    const chapterTree = buildChapterTree();

    // Debug log the chapter tree
    console.log('Chapter tree:', JSON.stringify(chapterTree, null, 2));
    
    // Return both the flat list and the tree structure
    return NextResponse.json({
      flat: allChapters,
      tree: chapterTree
    });
  } catch (error) {
    console.error('Error fetching chapters:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/books/by-slug/[slug]/chapters
 * Create a new chapter for a book by slug
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;

  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { title, content, parentChapterId, order, level, isDraft } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'Title is required and must be a string' }, { status: 400 });
    }

    const [dbUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, user.id))
      .limit(1);

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    const book = await db.query.books.findFirst({
      where: (books, { and, eq }) => and(
        eq(books.slug, slug),
        eq(books.userId, dbUser.id)
      ),
    });

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    const [lastChapter] = await db
      .select()
      .from(chapters)
      .where(eq(chapters.bookId, book.id))
      .orderBy(desc(chapters.order))
      .limit(1);

    const newOrder = order !== undefined ? order : (lastChapter?.order || 0) + 1;
    const newLevel = level !== undefined ? level : (parentChapterId ? 1 : 0);

    const [newChapter] = await db.insert(chapters).values({
      bookId: book.id,
      title,
      content: content || '',
      parentChapterId: parentChapterId || null,
      order: newOrder,
      level: newLevel,
      isDraft: isDraft !== undefined ? isDraft : true,
      wordCount: content ? content.split(/\s+/).length : 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return NextResponse.json(newChapter, { status: 201 });
  } catch (error) {
    console.error('Error creating chapter:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
