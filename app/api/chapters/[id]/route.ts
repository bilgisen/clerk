import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { chapters } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { error: 'Chapter ID is required' },
        { status: 400 }
      );
    }

    // Fetch the chapter
    const chapter = await db.query.chapters.findFirst({
      where: and(
        eq(chapters.id, id),
        eq(chapters.userId, userId)
      ),
    });

    if (!chapter) {
      return NextResponse.json(
        { error: 'Chapter not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(chapter);
  } catch (error) {
    console.error('Error fetching chapter:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chapter' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { error: 'Chapter ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { title, content, order, level, parentChapterId } = body;

    // Check if chapter exists and belongs to user
    const existingChapter = await db.query.chapters.findFirst({
      where: and(
        eq(chapters.id, id),
        eq(chapters.userId, userId)
      ),
    });

    if (!existingChapter) {
      return NextResponse.json(
        { error: 'Chapter not found' },
        { status: 404 }
      );
    }

    // Update the chapter
    const [updatedChapter] = await db
      .update(chapters)
      .set({
        ...(title && { title }),
        ...(content !== undefined && { content }),
        ...(order !== undefined && { order }),
        ...(level !== undefined && { level }),
        ...(parentChapterId !== undefined && { parentChapterId }),
        updatedAt: new Date(),
      })
      .where(eq(chapters.id, id))
      .returning();

    return NextResponse.json(updatedChapter);
  } catch (error) {
    console.error('Error updating chapter:', error);
    return NextResponse.json(
      { error: 'Failed to update chapter' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { error: 'Chapter ID is required' },
        { status: 400 }
      );
    }

    // Check if chapter exists and belongs to user
    const existingChapter = await db.query.chapters.findFirst({
      where: and(
        eq(chapters.id, id),
        eq(chapters.userId, userId)
      ),
    });

    if (!existingChapter) {
      return NextResponse.json(
        { error: 'Chapter not found' },
        { status: 404 }
      );
    }

    // Delete the chapter
    await db
      .delete(chapters)
      .where(eq(chapters.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting chapter:', error);
    return NextResponse.json(
      { error: 'Failed to delete chapter' },
      { status: 500 }
    );
  }
}
