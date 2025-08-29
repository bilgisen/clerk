// api/books/[slug]/chapters/[chapterId]/route.ts 
import { db } from "@/db/drizzle";
import { books, chapters } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse, NextRequest } from "next/server";
import { createApiHandler } from "@/lib/utils/api-handler";
import { chapterParamsSchema, updateChapterSchema } from "@/lib/validations/chapter";

const handler = createApiHandler({
  paramsSchema: chapterParamsSchema,
  bodySchema: updateChapterSchema,
});

// GET: Get a single chapter by ID
export const GET = async (request: NextRequest, context: { params: unknown }) => {
  const result = await handler.GET(request, context);
  if (result instanceof NextResponse) return result;
  
  const { params, body } = result;
  const { slug, chapterId } = params;

  try {
    const bookWithChapter = await db.query.books.findFirst({
      where: eq(books.slug, slug),
      with: {
        chapters: {
          where: eq(chapters.id, chapterId),
          limit: 1,
        },
      },
    });

    if (!bookWithChapter?.chapters.length) {
      return NextResponse.json(
        { error: "Chapter not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(bookWithChapter.chapters[0]);
  } catch (error) {
    console.error("Failed to fetch chapter:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};

// PATCH: Update a chapter
export const PATCH = async (request: NextRequest, context: { params: unknown }) => {
  const result = await handler.PATCH(request, context);
  if (result instanceof NextResponse) return result;
  
  const { params, body } = result;
  const { slug, chapterId } = params as { slug: string; chapterId: string };
  const updateData = body as Partial<{
    title: string;
    content: string;
    order: number;
    level: number;
    parentChapterId: string | null;
    isDraft: boolean;
  }>;

  try {
    const book = await db.query.books.findFirst({
      where: eq(books.slug, slug),
      columns: { id: true },
    });

    if (!book) {
      return NextResponse.json(
        { error: "Book not found" },
        { status: 404 }
      );
    }

    const updateFields: Record<string, any> = {};
    
    // Only include fields that are actually provided in the request
    if (updateData.title !== undefined) updateFields.title = updateData.title;
    if (updateData.content !== undefined) updateFields.content = updateData.content;
    if (updateData.order !== undefined) updateFields.order = updateData.order;
    if (updateData.level !== undefined) updateFields.level = updateData.level;
    if (updateData.parentChapterId !== undefined) updateFields.parentChapterId = updateData.parentChapterId;
    if (updateData.isDraft !== undefined) updateFields.isDraft = updateData.isDraft;
    
    // Always update the updatedAt field
    updateFields.updatedAt = new Date();

    const [updatedChapter] = await db
      .update(chapters)
      .set(updateFields)
      .where(
        and(
          eq(chapters.id, chapterId),
          eq(chapters.bookId, book.id)
        )
      )
      .returning();

    if (!updatedChapter) {
      return NextResponse.json(
        { error: "Chapter not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedChapter);
  } catch (error) {
    console.error("Failed to update chapter:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};

// DELETE: Delete a chapter
export const DELETE = async (request: NextRequest, context: { params: unknown }) => {
  const result = await handler.DELETE(request, context);
  if (result instanceof NextResponse) return result;
  
  const { params } = result;
  const { slug, chapterId } = params;

  try {
    const book = await db.query.books.findFirst({
      where: eq(books.slug, slug),
      columns: { id: true },
    });

    if (!book) {
      return NextResponse.json(
        { error: "Book not found" },
        { status: 404 }
      );
    }

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
        { error: "Chapter not found" },
        { status: 404 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete chapter:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};
