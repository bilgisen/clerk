import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/drizzle';
import { chapters } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// Schema for updating a chapter
const updateChapterSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  content: z.string().optional(),
  order: z.number().int().min(0).optional(),
  level: z.number().int().min(1).max(6).optional(),
  parentChapterId: z.string().uuid('Invalid parent chapter ID').nullable().optional(),
  isDraft: z.boolean().optional(),
});

type UpdateChapterInput = z.infer<typeof updateChapterSchema>;

// GET: Get a single chapter by ID
export async function GET(
  request: Request,
  { params }: { params: { chapterId: string } }
) {
  try {
    const { chapterId } = params;

    const chapter = await db.query.chapters.findFirst({
      where: eq(chapters.id, chapterId),
    });

    if (!chapter) {
      return NextResponse.json(
        { error: 'Chapter not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(chapter);
  } catch (error) {
    console.error('Failed to fetch chapter:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// PATCH: Update a chapter
export async function PATCH(
  request: Request,
  { params }: { params: { chapterId: string } }
) {
  try {
    const { chapterId } = params;
    
    // Parse and validate request body
    const body = await request.json();
    const validation = updateChapterSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.format() },
        { status: 400 }
      );
    }

    // Prepare update data (exclude undefined values)
    const updateData: Record<string, any> = {};
    
    if (validation.data.title !== undefined) updateData.title = validation.data.title;
    if (validation.data.content !== undefined) updateData.content = validation.data.content;
    if (validation.data.order !== undefined) updateData.order = validation.data.order;
    if (validation.data.level !== undefined) updateData.level = validation.data.level;
    if (validation.data.parentChapterId !== undefined) updateData.parentChapterId = validation.data.parentChapterId;
    if (validation.data.isDraft !== undefined) updateData.isDraft = validation.data.isDraft;
    
    // Always update the updatedAt field
    updateData.updatedAt = new Date();

    const [updatedChapter] = await db
      .update(chapters)
      .set(updateData)
      .where(eq(chapters.id, chapterId))
      .returning();

    if (!updatedChapter) {
      return NextResponse.json(
        { error: 'Chapter not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedChapter);
  } catch (error) {
    console.error('Failed to update chapter:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// DELETE: Delete a chapter
export async function DELETE(
  request: Request,
  { params }: { params: { chapterId: string } }
) {
  try {
    const { chapterId } = params;

    const [deletedChapter] = await db
      .delete(chapters)
      .where(eq(chapters.id, chapterId))
      .returning();

    if (!deletedChapter) {
      return NextResponse.json(
        { error: 'Chapter not found' },
        { status: 404 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete chapter:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
