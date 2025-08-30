import { NextResponse } from 'next/server';
import { db } from '@/db';
import { chapters } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function POST(req: Request) {
  try {
    // Parse request body
    const updates: { id: string; parentId: string | null; order: number }[] = await req.json();
    
    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request format. Expected an array of updates.' },
        { status: 400 }
      );
    }

    // Update chapters in a transaction
    const dbWithTransaction = db as unknown as PostgresJsDatabase<Record<string, unknown>>;
    await dbWithTransaction.transaction(async (tx) => {
      for (const update of updates) {
        await tx
          .update(chapters)
          .set({
            parentChapterId: update.parentId,
            order: update.order,
            updatedAt: new Date(),
          })
          .where(eq(chapters.id, update.id));
      }
    });

    return NextResponse.json({ 
      success: true,
      message: 'Chapter order updated successfully',
      updatedCount: updates.length
    });
      
  } catch (error) {
    console.error('Error updating chapter order:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
