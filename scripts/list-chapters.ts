import { db } from '../db/drizzle';
import { books, chapters } from '../db/schema';
import { eq } from 'drizzle-orm';

async function listChapters(bookSlug: string) {
  try {
    // Get the book by slug
    const [book] = await db
      .select()
      .from(books)
      .where(eq(books.slug, bookSlug))
      .limit(1);

    if (!book) {
      console.error(`Book not found with slug: ${bookSlug}`);
      process.exit(1);
    }

    console.log(`Found book: ${book.title} (${book.id})`);
    
    // Get all chapters for the book
    const allChapters = await db
      .select()
      .from(chapters)
      .where(eq(chapters.bookId, book.id))
      .orderBy(chapters.order);

    console.log(`\nFound ${allChapters.length} chapters:`);
    console.log('----------------------------------------');
    
    allChapters.forEach((chapter, index) => {
      console.log(`Chapter ${index + 1}:`);
      console.log(`  ID: ${chapter.id}`);
      console.log(`  Title: ${chapter.title || 'Untitled'}`);
      console.log(`  Order: ${chapter.order}`);
      console.log(`  Created: ${chapter.createdAt}`);
      console.log('----------------------------------------');
    });

    process.exit(0);
  } catch (error) {
    console.error('Error listing chapters:', error);
    process.exit(1);
  }
}

// Get book slug from command line argument or use 'the-hobbit' as default
const bookSlug = process.argv[2] || 'the-hobbit';
listChapters(bookSlug);
