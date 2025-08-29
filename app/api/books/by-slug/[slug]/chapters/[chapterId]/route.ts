// app/api/books/by-slug/[slug]/chapters/[chapterId]/route.ts
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/db/drizzle';
import { and, eq } from 'drizzle-orm';
import { books, chapters, users } from '@/db/schema';

// Configure the route to handle UUIDs with hyphens
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

// This ensures the full path is captured
export const config = {
  api: {
    bodyParser: false,
  },
};

// GET: Get a single chapter by ID for a book by slug
export async function GET(
  request: Request,
  context: { params: { slug: string; chapterId: string } }
) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    // Await params before destructuring
    const { slug, chapterId } = await context.params;
    if (!slug || !chapterId) {
      return NextResponse.json({ error: 'Book slug and chapter ID are required' }, { status: 400 });
    }

    const [dbUser] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, user.id)).limit(1);
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const book = await db.query.books.findFirst({
      where: (b, { and, eq }) => and(eq(b.slug, slug), eq(b.userId, dbUser.id)),
    });
    if (!book) return NextResponse.json({ error: 'Book not found' }, { status: 404 });

    const chapter = await db.query.chapters.findFirst({
      where: (c, { and, eq }) => and(eq(c.id, chapterId), eq(c.bookId, book.id)),
    });
    if (!chapter) return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });

    // Return the chapter data
    return NextResponse.json(chapter);
    
  } catch (error) {
    console.error('Error in GET /api/books/by-slug/[slug]/chapters/[chapterId]:', error);
    return NextResponse.json(
      { 
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

// PATCH: Update a chapter
export async function PATCH(
  request: Request,
  context: { params: { slug: string; chapterId: string } }
) {
  try {
    // Ensure user is authenticated with Clerk
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' }, 
        { status: 401 }
      );
    }

    const { slug, chapterId } = context.params;
    if (!slug || !chapterId) {
      return NextResponse.json(
        { error: 'Book slug and chapter ID are required' }, 
        { status: 400 }
      );
    }

    const [dbUser] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, user.id)).limit(1);
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const book = await db.query.books.findFirst({
      where: (b, { and, eq }) => and(eq(b.slug, slug), eq(b.userId, dbUser.id)),
    });
    if (!book) return NextResponse.json({ error: 'Book not found' }, { status: 404 });

    const body = await request.json();
    const { title, content, parentChapterId, order, level } = body;

    if (
      !title &&
      content === undefined &&
      parentChapterId === undefined &&
      order === undefined &&
      level === undefined
    ) {
      return NextResponse.json({ error: 'At least one field must be updated' }, { status: 400 });
    }

    const updateData: {
      updatedAt: Date;
      title?: string;
      content?: string;
      isDraft?: boolean;
      order?: number;
      level?: number;
      parentChapterId?: string | null;
      wordCount?: number;
    } = {
      updatedAt: new Date(),
    };
    if (title) updateData.title = title;
    if (content !== undefined) {
      updateData.content = content;
      updateData.wordCount = content ? content.trim().split(/\s+/).length : 0;
    }
    if (parentChapterId !== undefined) updateData.parentChapterId = parentChapterId;
    if (order !== undefined) updateData.order = order;
    if (level !== undefined) updateData.level = level;

    // Update the chapter if it belongs to the book
    const [chapter] = await db
      .update(chapters)
      .set(updateData)
      .where(
        and(
          eq(chapters.id, chapterId), 
          eq(chapters.bookId, book.id)
        )
      )
      .returning();

    if (!chapter) {
      return NextResponse.json(
        { error: 'Chapter not found or access denied' }, 
        { status: 404 }
      );
    }

    return NextResponse.json(chapter);
  } catch (error) {
    console.error('Error in PATCH /api/books/by-slug/[slug]/chapters/[chapterId]:', error);
    return NextResponse.json(
      { 
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

// DELETE: Delete a chapter
export async function DELETE(
  _req: Request,
  context: { params: { slug: string; chapterId: string } }
) {
  try {
    // Ensure user is authenticated with Clerk
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' }, 
        { status: 401 }
      );
    }

    const { slug, chapterId } = context.params;
    if (!slug || !chapterId) {
      return NextResponse.json(
        { error: 'Book slug and chapter ID are required' }, 
        { status: 400 }
      );
    }

    const [dbUser] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, user.id)).limit(1);
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const book = await db.query.books.findFirst({
      where: (b, { and, eq }) => and(eq(b.slug, slug), eq(b.userId, dbUser.id)),
    });
    if (!book) return NextResponse.json({ error: 'Book not found' }, { status: 404 });

    const chapter = await db.query.chapters.findFirst({
      where: (c, { and, eq }) => and(eq(c.id, chapterId), eq(c.bookId, book.id)),
    });
    if (!chapter) return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });

    // Delete the chapter if it belongs to the book
    const [deletedChapter] = await db
      .delete(chapters)
      .where(
        and(
          eq(chapters.id, chapterId), 
          eq(chapters.bookId, book.id)
        )
      )
      .returning();

    if (!deletedChapter) {
      return NextResponse.json(
        { error: 'Chapter not found or access denied' }, 
        { status: 404 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error in DELETE /api/books/by-slug/[slug]/chapters/[chapterId]:', error);
    return NextResponse.json(
      { 
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}
