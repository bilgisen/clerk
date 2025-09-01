import { db } from './index';
import { users } from './schema';

async function test() {
  try {
    const allUsers = await db.select().from(users);
    console.log('Database connection successful!');
    console.log('Users:', allUsers);
  } catch (error) {
    console.error('Database connection failed:', error);
  } finally {
    process.exit(0);
  }
}

test();
