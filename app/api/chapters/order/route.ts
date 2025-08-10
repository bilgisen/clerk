import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { chapters, books } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { ChapterOrderUpdate } from '@/types/dnd';

export async function PATCH(request: Request) {
  try {
    console.log('Received chapter order update request');
    
    // Verify authentication using Clerk's auth()
    const session = await auth();
    const clerkUserId = session?.userId;
    
    if (!clerkUserId) {
      console.error('Unauthorized: No user ID found in session');
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          details: 'You must be logged in to update chapter order',
          session: session ? 'Session exists but no userId' : 'No session found'
        },
        { status: 401 }
      );
    }
    
    console.log('Authenticated Clerk user ID:', clerkUserId);
    
    // Get the database user ID from Clerk user ID
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.clerkId, clerkUserId),
      columns: { id: true }
    });
    
    if (!user) {
      console.error('User not found in database for Clerk ID:', clerkUserId);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const userId = user.id;
    console.log('Database user ID:', userId);

    // Parse request body
    let requestBody;
    try {
      requestBody = await request.json();
      console.log('Request body:', JSON.stringify(requestBody, null, 2));
      
      if (!requestBody || !requestBody.updates || !Array.isArray(requestBody.updates)) {
        console.error('Invalid request format - missing or invalid updates array');
        return NextResponse.json(
          { error: 'Invalid request format. Expected { updates: ChapterOrderUpdate[] }' },
          { status: 400 }
        );
      }
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { updates } = requestBody as { updates: ChapterOrderUpdate[] };
    
    if (updates.length === 0) {
      console.warn('Empty updates array received');
      return NextResponse.json(
        { error: 'No updates provided' },
        { status: 400 }
      );
    }

    // Log the updates for debugging
    console.log(`Processing ${updates.length} chapter order updates`);
    
    // Get all chapter IDs being updated
    const chapterIds = updates.map(update => update.id);
    console.log('Chapter IDs to update:', chapterIds);
    
    try {
      // Verify all chapters belong to the user by joining with books table
      console.log('Verifying chapter ownership...');
      const userChapters = await db
        .select({ id: chapters.id })
        .from(chapters)
        .innerJoin(books, eq(chapters.bookId, books.id))
        .where(
          and(
            inArray(chapters.id, chapterIds),
            eq(books.userId, userId)
          )
        );

      // Check if all chapters exist and belong to the user
      if (userChapters.length !== chapterIds.length) {
        console.error('Chapter ownership verification failed', {
          expected: chapterIds.length,
          found: userChapters.length,
          missing: chapterIds.filter(id => !userChapters.some(c => c.id === id))
        });
        return NextResponse.json(
          { error: 'One or more chapters not found or access denied' },
          { status: 403 }
        );
      }

      console.log('Updating chapters in transaction...');
      // Update chapters in a transaction
      await db.transaction(async (tx) => {
        for (const update of updates) {
          console.log(`Updating chapter ${update.id}:`, {
            order: update.order,
            level: update.level,
            parent_chapter_id: update.parent_chapter_id
          });
          
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

      console.log('Chapter order update successful');
      return NextResponse.json({ 
        success: true,
        message: 'Chapter order updated successfully',
        updatedCount: updates.length
      });
      
    } catch (dbError) {
      console.error('Database error during chapter order update:', dbError);
      return NextResponse.json(
        { 
          error: 'Database error',
          details: dbError instanceof Error ? dbError.message : 'Unknown database error'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Unexpected error in chapter order update:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
