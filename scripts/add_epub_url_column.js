const { Client } = require('pg');
require('dotenv').config();

async function addEpubUrlColumn() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('Connected to the database');

    // Add the epub_url column if it doesn't exist
    await client.query(`
      ALTER TABLE books 
      ADD COLUMN IF NOT EXISTS epub_url TEXT;
    `);

    console.log('Successfully added epub_url column to the books table');

    // Verify the column was added
    const result = await client.query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_name = 'books' 
       AND column_name = 'epub_url'`
    );

    console.log('Verification results:');
    console.table(result.rows);
  } catch (error) {
    console.error('Error adding column:', error);
  } finally {
    await client.end();
  }
}

addEpubUrlColumn();
