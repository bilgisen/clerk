import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/drizzle';
import { chapters } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';

export type ReorderPatch = {
  id: string;
  order: number;
  level: number;
  parentChapterId: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      bookId: string;
      patches: ReorderPatch[];
    };

    if (!body?.bookId || !Array.isArray(body?.patches)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const ids = body.patches.map((p) => p.id);

    // Security: Ensure all chapters being patched belong to the same book
    const existing = await db
      .select({ id: chapters.id, bookId: chapters.bookId })
      .from(chapters)
      .where(inArray(chapters.id, ids));

    if (existing.some((c) => c.bookId !== body.bookId)) {
      return NextResponse.json({ error: 'Cross-book update not allowed' }, { status: 400 });
    }

    // Update all chapters in parallel without transaction
    await Promise.all(
      body.patches.map(p => 
        db.update(chapters)
          .set({
            order: p.order,
            level: p.level,
            parentChapterId: p.parentChapterId,
            updatedAt: new Date(),
          })
          .where(eq(chapters.id, p.id))
      )
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
