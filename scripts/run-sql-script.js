const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://neondb_owner:npg_WBGaS6d7vtbA@ep-lingering-grass-a2xxclbr-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require';

async function runSqlScript() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected to the database');
    
    // Read the SQL file
    const sql = fs.readFileSync(path.join(__dirname, 'add-unique-clerk-id.sql'), 'utf8');
    
    // Execute the SQL
    console.log('Running SQL script...');
    const result = await client.query(sql);
    
    console.log('SQL script executed successfully');
    console.log('Rows affected:', result.rowCount);
    
  } catch (error) {
    console.error('Error executing SQL script:', error);
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

runSqlScript();
