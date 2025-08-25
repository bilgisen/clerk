import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { chapters, books } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;

    const book = await db.query.books.findFirst({
      where: eq(books.slug, slug),
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const result = await db.query.chapters.findMany({
      where: eq(chapters.bookId, book.id),
      orderBy: desc(chapters.createdAt),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching chapters:", error);
    return NextResponse.json(
      { error: "Failed to fetch chapters" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const body = await request.json();

    const book = await db.query.books.findFirst({
      where: eq(books.slug, slug),
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const { title, content, order, parentChapterId, level, isDraft } = body;

    const [chapter] = await db
      .insert(chapters)
      .values({
        bookId: book.id,
        title,
        content: content ? JSON.parse(content) : null,
        order,
        parentChapterId,
        level,
        isDraft: isDraft ?? false,
      })
      .returning();

    return NextResponse.json(chapter, { status: 201 });
  } catch (error) {
    console.error("Error creating chapter:", error);
    return NextResponse.json(
      { error: "Failed to create chapter" },
      { status: 500 }
    );
  }
}
