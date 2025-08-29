import { db } from '../db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Running migration: Add workflow_id to books table');
  
  try {
    // Add workflow_id column if it doesn't exist
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'books' AND column_name = 'workflow_id'
        ) THEN
          ALTER TABLE books ADD COLUMN workflow_id TEXT;
          CREATE INDEX IF NOT EXISTS workflow_id_idx ON books(workflow_id);
          RAISE NOTICE 'Added workflow_id column to books table';
        ELSE
          RAISE NOTICE 'workflow_id column already exists in books table';
        END IF;
      END
      $$;
    `);
    
    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
