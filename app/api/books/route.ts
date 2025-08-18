import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { books } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * GET /api/books
 * Get all books for the authenticated user
 */
export async function GET() {
  try {
    console.log('GET /api/books - Starting request');
    // Get the current user session
    const session = await auth();
    const userId = session.userId;
    console.log('Session user ID:', userId);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    // First, get the user's database ID using their Clerk ID
    console.log('Looking up user in database with clerkId:', userId);
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.clerkId, userId)
    });
    console.log('Database user found:', user ? 'Yes' : 'No');

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' }, 
        { status: 404 }
      );
    }

    // Fetch all books for the current user using their database ID
    console.log('Fetching books for user ID:', user?.id);
    const userBooks = await db.query.books.findMany({
      where: (books, { eq }) => eq(books.userId, user.id),
      orderBy: (books, { desc }) => [desc(books.createdAt)],
    });
    console.log('Books found:', userBooks.length);

    return NextResponse.json(userBooks);
  } catch (error) {
    console.error('Error fetching books:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
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
      where: (users, { eq }) => eq(users.clerkId, clerkUserId)
    });

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
