// app/api/books/by-slug/[slug]/chapters/route.ts
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db/server';
import { books, chapters, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

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
      where: (booksTable, { eq, and: andFn }) => {
        return andFn(
          eq(booksTable.slug, slug as string),
          eq(booksTable.userId, dbUser.id)
        );
      },
      columns: {
        id: true,
        title: true,
        slug: true,
        description: true,
        coverImageUrl: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        genre: true,
        language: true,
        isbn: true,
        wordCount: true,
        readingTime: true,
        isPublic: true,
        price: true,
        currency: true,
        isFeatured: true,
        metadata: true,
        deletedAt: true
      }
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
        publishedAt: true,
        excerpt: true
      }
    });

    // Define the chapter type with children
    type ChapterWithChildren = typeof allChapters[number] & {
      children: ChapterWithChildren[];
    };

    // Create a type-safe filter function
    const filterChapters = (chaptersList: typeof allChapters, parentId: string | null) => {
      return chaptersList.filter(chapter => 
        (parentId === null && !chapter.parentChapterId) || 
        (chapter.parentChapterId === parentId)
      );
    };

    // Then, build the hierarchical structure
    const buildChapterTree = (parentId: string | null = null): ChapterWithChildren[] => {
      const filteredChapters = filterChapters(allChapters, parentId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      
      return filteredChapters.map(chapter => ({
        ...chapter,
        children: buildChapterTree(chapter.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      }));
    };

    const chapterTree = buildChapterTree().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

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

    const [dbUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, user.id))
      .limit(1);

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    const book = await db.query.books.findFirst({
      where: (booksTable, { eq, and: andFn }) => {
        return andFn(
          eq(booksTable.slug, slug as string),
          eq(booksTable.userId, dbUser.id)
        );
      }
    });

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    const body = await request.json();
    const { title, content, parentChapterId, order, level = 0 } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const newChapter = await db.insert(chapters).values({
      title,
      content: content || '',
      book_id: book.id,
      parent_chapter_id: parentChapterId || null,
      order: order ?? 0,
      level: level,
      is_draft: true,
      word_count: 0,
      user_id: dbUser.id
    }).returning();

    return NextResponse.json(newChapter[0]);
  } catch (error) {
    console.error('Error creating chapter:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
