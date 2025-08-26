import { db } from '../db/drizzle';
import { books } from '../db/schema';
import { eq } from 'drizzle-orm';

async function listBooks() {
  try {
    const allBooks = await db.query.books.findMany({
      columns: {
        id: true,
        title: true,
        slug: true,
        isPublished: true
      },
      limit: 5
    });
    
    console.log('Found books:');
    console.table(allBooks);
    
    // Return the first book ID for testing
    if (allBooks.length > 0) {
      return allBooks[0].id;
    }
    return null;
  } catch (error) {
    console.error('Error listing books:', error);
    return null;
  }
}

listBooks().then(id => {
  if (id) {
    console.log('\nUse this ID for testing:', id);
  } else {
    console.log('No books found or error occurred');
  }
  process.exit(0);
});
