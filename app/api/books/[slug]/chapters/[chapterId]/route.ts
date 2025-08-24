import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { chapters } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string; chapterId: string } }
) {
  try {
    const chapterId = String(params.chapterId);

    const chapter = await db.query.chapters.findFirst({
      where: eq(chapters.id, chapterId),
    });

    if (!chapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    return NextResponse.json(chapter);
  } catch (error) {
    console.error("Error fetching chapter:", error);
    return NextResponse.json(
      { error: "Failed to fetch chapter" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string; chapterId: string } }
) {
  try {
    const chapterId = String(params.chapterId);
    const body = await request.json();

    const { title, content, order, parentChapterId, level, isDraft } = body;

    const [updatedChapter] = await db
      .update(chapters)
      .set({
        ...(title !== undefined && { title }),
        ...(content !== undefined && {
          content: typeof content === "string" ? JSON.parse(content) : content,
        }),
        ...(order !== undefined && { order }),
        ...(parentChapterId !== undefined && { parentChapterId }),
        ...(level !== undefined && { level }),
        ...(isDraft !== undefined && { isDraft }),
        updatedAt: new Date(),
      })
      .where(eq(chapters.id, chapterId))
      .returning();

    if (!updatedChapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    return NextResponse.json(updatedChapter);
  } catch (error) {
    console.error("Error updating chapter:", error);
    return NextResponse.json(
      { error: "Failed to update chapter" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { slug: string; chapterId: string } }
) {
  try {
    const chapterId = String(params.chapterId);

    const [deletedChapter] = await db
      .delete(chapters)
      .where(eq(chapters.id, chapterId))
      .returning();

    if (!deletedChapter) {
      return NextResponse.json({ success: false, error: "Chapter not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting chapter:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete chapter" },
      { status: 500 }
    );
  }
}
