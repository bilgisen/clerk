const { Client } = require('pg');
require('dotenv').config();

async function renameColumn() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('Connected to the database');

    // Check if the column exists
    const checkResult = await client.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'books' 
       AND column_name = 'epubUrl'`
    );

    if (checkResult.rows.length === 0) {
      console.log('Column epubUrl does not exist or has already been renamed');
      return;
    }

    // Rename the column
    await client.query('ALTER TABLE books RENAME COLUMN "epubUrl" TO "epub_url"');
    console.log('Successfully renamed column from epubUrl to epub_url');

    // Verify the column was renamed
    const verifyResult = await client.query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_name = 'books' 
       AND column_name IN ('epub_url', 'epubUrl')`
    );

    console.log('Verification results:', verifyResult.rows);
  } catch (error) {
    console.error('Error renaming column:', error);
  } finally {
    await client.end();
  }
}

renameColumn();
