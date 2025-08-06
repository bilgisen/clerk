import { db } from '../db/drizzle';
import { books, users } from '../db/schema';
import { eq } from 'drizzle-orm';

async function checkBookOwnership() {
  try {
    // Get the book by slug
    const book = await db.query.books.findFirst({
      where: eq(books.slug, 'hobbitin-donusu'),
      with: {
        user: {
          columns: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      columns: {
        id: true,
        title: true,
        slug: true,
        userId: true
      }
    });

    if (!book) {
      console.log('Book not found');
      return;
    }

    console.log('Book found:');
    console.log({
      id: book.id,
      title: book.title,
      slug: book.slug,
      userId: book.userId,
      owner: book.user
    });

    // Get the current user
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, 'user_2ykP46hBE1C0zuYUYJnhH1BPqMS'),
      columns: {
        id: true,
        email: true,
        firstName: true,
        lastName: true
      }
    });

    console.log('\nCurrent user:');
    console.log(currentUser);

    // Check if the user has access to the book
    const hasAccess = await db.query.books.findFirst({
      where: (books, { and, eq, or }) => and(
        eq(books.id, book.id),
        or(
          eq(books.userId, 'user_2ykP46hBE1C0zuYUYJnhH1BPqMS'),
          // Add any other conditions for shared access here
        )
      )
    });

    console.log('\nAccess check:');
    console.log(hasAccess ? 'User has access' : 'User does not have access');

  } catch (error) {
    console.error('Error checking book ownership:', error);
  } finally {
    process.exit(0);
  }
}

checkBookOwnership();
