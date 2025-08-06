import { sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase) {
  // Rename epubUrl to epub_url
  await db.execute(sql`
    ALTER TABLE books 
    RENAME COLUMN "epubUrl" TO "epub_url";
  `);
}

export async function down(db: PostgresJsDatabase) {
  // Revert the column name back to epubUrl
  await db.execute(sql`
    ALTER TABLE books 
    RENAME COLUMN "epub_url" TO "epubUrl";
  `);
}
