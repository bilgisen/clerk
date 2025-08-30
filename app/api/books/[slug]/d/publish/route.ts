import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { books } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { z } from "zod";

// Request body schema
const publishBookSchema = z.object({});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    const session = await auth();
    const userId = session.userId;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!slug) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validation = publishBookSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validation.error.format() },
        { status: 400 }
      );
    }

    const book = await db.query.books.findFirst({
      where: and(eq(books.slug, slug), eq(books.userId, userId)),
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    await db
      .update(books)
      .set({ publishStatus: "GENERATING", updatedAt: new Date() })
      .where(eq(books.slug, slug));

    try {
      const epubUrl = await generateEPUB(book.id);

      await db
        .update(books)
        .set({
          publishStatus: "PUBLISHED",
          epubUrl,
          isPublished: true,
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(books.slug, slug));

      return NextResponse.json({ success: true, url: epubUrl });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      await db
        .update(books)
        .set({
          publishStatus: "FAILED",
          publishError: errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(books.slug, slug));

      logger.error("Failed to publish book", { slug, userId, error: errorMessage });

      return NextResponse.json(
        { error: "Failed to publish book", details: errorMessage },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error("Error in publish endpoint", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Mock EPUB generation function
async function generateEPUB(bookId: string): Promise<string> {
  // In a real implementation, this would generate the EPUB file
  // and return the URL where it's stored (e.g., S3, R2, etc.)
  await new Promise(resolve => setTimeout(resolve, 1000));
  return `https://storage.example.com/books/${bookId}/book.epub`;
}
