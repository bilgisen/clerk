import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

dotenv.config();

async function checkDbConnection() {
  try {
    console.log('Connecting to database...');
    
    // Use DATABASE_URL_UNPOOLED if available, otherwise fall back to DATABASE_URL
    const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL or DATABASE_URL_UNPOOLED environment variable is not set');
    }
    
    const client = postgres(databaseUrl);
    const db = drizzle(client);
    
    // Test the connection by querying the users table
    console.log('Querying users table...');
    const result = await client`SELECT 1 as test`;
    console.log('Database connection successful!', result);
    
    // List all tables in the public schema
    const tables = await client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    
    console.log('\nAvailable tables:');
    console.table(tables);
    
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
}

checkDbConnection();
