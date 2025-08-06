const { Client } = require('pg');
require('dotenv').config();

async function checkColumns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('Connected to the database');

    // Check all columns in the books table
    const result = await client.query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_name = 'books'`
    );

    console.log('Columns in the books table:');
    console.table(result.rows);
    
    // Check specifically for epub-related columns
    const epubColumns = result.rows.filter(row => 
      row.column_name.includes('epub') || 
      row.column_name.includes('Epub') || 
      row.column_name.includes('EPUB')
    );
    
    console.log('\nEPUB-related columns:');
    console.table(epubColumns);
    
  } catch (error) {
    console.error('Error checking columns:', error);
  } finally {
    await client.end();
  }
}

checkColumns();
