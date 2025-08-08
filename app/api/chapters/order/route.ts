import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { chapters } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { ChapterOrderUpdate } from '@/types/dnd';

export async function PATCH(request: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { updates } = await request.json() as { updates: ChapterOrderUpdate[] };
    
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'No updates provided' },
        { status: 400 }
      );
    }

    // Get all chapter IDs being updated
    const chapterIds = updates.map(update => update.id);
    
    // Verify all chapters belong to the user
    const userChapters = await db.query.chapters.findMany({
      where: and(
        inArray(chapters.id, chapterIds),
        eq(chapters.userId, userId)
      ),
      columns: { id: true },
    });

    // Check if all chapters exist and belong to the user
    if (userChapters.length !== chapterIds.length) {
      return NextResponse.json(
        { error: 'One or more chapters not found or access denied' },
        { status: 403 }
      );
    }

    // Update chapters in a transaction
    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx
          .update(chapters)
          .set({
            order: update.order,
            level: update.level,
            parentChapterId: update.parent_chapter_id,
            updatedAt: new Date(),
          })
          .where(eq(chapters.id, update.id));
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating chapter order:', error);
    return NextResponse.json(
      { error: 'Failed to update chapter order' },
      { status: 500 }
    );
  }
}
