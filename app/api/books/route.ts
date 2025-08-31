import 'server-only';

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/better-auth';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/server';
import { books, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { creditService } from '@/lib/services/credits/credit-service';

// Force this route to be server-side only
export const dynamic = 'force-dynamic';

type User = InferSelectModel<typeof users>;
type NewBook = InferInsertModel<typeof books>;

/**
 * GET /api/books
 * Get all books for the authenticated user
 */
export async function GET(): Promise<NextResponse> {
  try {
    // Get the current user session
    const session = await auth.api.getSession({
      headers: new Headers({
        cookie: cookies().toString()
      })
    });
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    // Get the user's database ID
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' }, 
        { status: 404 }
      );
    }

    // Fetch all books for the current user using their database ID
    const userBooks = await db
      .select()
      .from(books)
      .where(eq(books.userId, user.id))
      .orderBy(books.createdAt);

    return NextResponse.json(userBooks);
  } catch (error) {
    console.error('Error in GET /api/books:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      }, 
      { status: 500 }
    );
  }
}

/**
 * POST /api/books
 * Create a new book for the authenticated user
 */
export async function POST(request: Request) {
  try {
    // Get the current user session
    const session = await auth.api.getSession({
      headers: new Headers({
        cookie: cookies().toString()
      })
    });
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }
    
    // Get the user's database ID
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' }, 
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { title, author, description, coverImageUrl } = body;

    if (!title || !author) {
      return NextResponse.json(
        { error: 'Title and author are required' },
        { status: 400 }
      );
    }

    // Generate a slug from the title
    const slug = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-')     // Replace spaces with hyphens
      .replace(/-+/g, '-')      // Replace multiple hyphens with single
      .trim();

    // Start a transaction
    const [newBook] = await db.transaction(async (tx) => {
      // Deduct credits first
      const creditResult = await creditService.spendCredits({
        userId: user.id,
        amount: 40,
        reason: 'book_creation',
        idempotencyKey: `create-book:${user.id}:${Date.now()}`,
        ref: undefined,
        metadata: {
          action: 'book_creation',
          bookTitle: title
        }
      });

      if (!creditResult.ok) {
        throw new Error('Failed to deduct credits for book creation');
      }

      // Create the book
      const [book] = await tx
        .insert(books)
        .values({
          title,
          author,
          description: description || null,
          coverImageUrl: coverImageUrl || null,
          userId: user.id,
          slug,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      return [{
        ...book,
        remainingCredits: creditResult.balance
      }];
    });

    return NextResponse.json(newBook, { status: 201 });
  } catch (error) {
    console.error('Error creating book:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Failed to create book'
      },
      { status: 500 }
    );
  }
}
