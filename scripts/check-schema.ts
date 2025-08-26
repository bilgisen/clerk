import { db } from '../db/drizzle';
import { sql } from 'drizzle-orm';

async function checkSchema() {
  try {
    console.log('Checking database schema...');
    
    // Get table information
    const tablesResult = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('\nTables in database:');
    console.table(tablesResult.rows);
    
    // Get columns for chapters table
    const columnsResult = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'chapters'
      ORDER BY ordinal_position
    `);
    
    console.log('\nColumns in chapters table:');
    console.table(columnsResult.rows);
    
    // Get a sample of chapters
    const sampleResult = await db.execute(sql`
      SELECT id, title, "order", book_id, parent_chapter_id, is_draft
      FROM chapters
      LIMIT 5
    `);
    
    console.log('\nSample chapters:');
    console.table(sampleResult.rows);
    
    // Check for the specific chapter we're looking for
    const specificChapter = await db.execute(sql`
      SELECT * FROM chapters WHERE id = '2337863b-cf23-4f45-ab48-2d8ec88977b7'
    `);
    
    console.log('\nSpecific chapter with ID 2337863b-cf23-4f45-ab48-2d8ec88977b7:');
    console.table(specificChapter.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking schema:', error);
    process.exit(1);
  }
}

checkSchema();
