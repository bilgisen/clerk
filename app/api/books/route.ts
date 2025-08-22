import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { books, users } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';

type User = InferSelectModel<typeof users>;

// Simple type for Drizzle's where function
type WhereFn = (table: any, op: any) => any;

// Simple type for Drizzle's orderBy function
type OrderByFn = (table: any, op: any) => any[];

/**
 * GET /api/books
 * Get all books for the authenticated user
 */
export async function GET(): Promise<NextResponse> {
  try {
    console.log('GET /api/books - Starting request');
    
    // Get the current user session
    console.log('Getting auth session...');
    const session = await auth();
    const userId = session?.userId;
    console.log('Session user ID:', userId);
    
    if (!userId) {
      console.error('No user ID found in session');
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    try {
      // First, get the user's database ID using their Clerk ID
      console.log('Looking up user in database with clerkId:', userId);
      const user = await db.query.users.findFirst({
        where: ((table: any, { eq }: any) => eq(table.clerkId, userId)) as WhereFn
      }) as User | undefined;
      console.log('Database user found:', user ? `Yes (ID: ${user.id})` : 'No');

      if (!user) {
        console.error('User not found in database');
        return NextResponse.json(
          { error: 'User not found' }, 
          { status: 404 }
        );
      }

      // Fetch all books for the current user using their database ID
      console.log('Fetching books for user ID:', user.id);
      const userBooks = await db.query.books.findMany({
        where: ((table: any, { eq }: any) => eq(table.userId, user.id)) as WhereFn,
        orderBy: ((table: any, { desc: descFn }: any) => [descFn(table.createdAt)]) as OrderByFn
      });
      console.log('Books found:', userBooks.length);
      
      // Log sample of books if any
      if (userBooks.length > 0) {
        console.log('Sample book:', {
          id: userBooks[0].id,
          title: userBooks[0].title,
          userId: userBooks[0].userId
        });
      }

      return NextResponse.json(userBooks);
    } catch (dbError) {
      console.error('Database error:', dbError);
      throw dbError;
    }
  } catch (error) {
    console.error('Error in GET /api/books:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
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
    const session = await auth();
    const clerkUserId = session.userId;
    
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }
    
    // Get the user's database ID using their Clerk ID
    const user = await db.query.users.findFirst({
      where: ((table: any, { eq: eqFn }: any) => eqFn(table.clerkId, clerkUserId)) as WhereFn
    }) as User | undefined;

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

    // Create a new book
    const [newBook] = await db.insert(books).values({
      title,
      author,
      description: description || null,
      coverImageUrl: coverImageUrl || null,
      userId: user.id,
      slug: title.toLowerCase().replace(/\s+/g, '-'), // Simple slug generation
    }).returning();

    return NextResponse.json(newBook, { status: 201 });
  } catch (error) {
    console.error('Error creating book:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
