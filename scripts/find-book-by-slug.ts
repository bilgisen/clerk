import { db } from '../db/drizzle';
import { books } from '../db/schema';
import { eq } from 'drizzle-orm';

async function findBookBySlug(slug: string) {
  try {
    const book = await db.query.books.findFirst({
      where: (books, { eq }) => eq(books.slug, slug),
      columns: {
        id: true,
        title: true,
        slug: true,
        isPublished: true
      }
    });
    
    if (book) {
      console.log('Found book:');
      console.table([book]);
      return book.id;
    } else {
      console.log(`No book found with slug: ${slug}`);
      return null;
    }
  } catch (error) {
    console.error('Error finding book:', error);
    return null;
  }
}

// Get slug from command line argument
const slug = process.argv[2] || 'the-hobbit';

findBookBySlug(slug).then(id => {
  if (id) {
    console.log('\nUse this ID for testing:', id);
  } else {
    console.log('No book found or error occurred');
  }
  process.exit(0);
});
