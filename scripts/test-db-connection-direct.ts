import { db, sql } from '@/db';
import { users } from '@/db/schema';
import { count } from 'drizzle-orm';

async function testConnection() {
  try {
    console.log('Testing database connection...');
    
    // Test raw query
    const result = await sql`SELECT 1 as test`;
    console.log('Raw query result:', result);
    
    // Test schema query
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log('Tables in public schema:', tables);
    
    // Test users table with Drizzle
    const userCount = await db.select({ count: count() }).from(users);
    console.log('User count:', userCount[0].count);
    
    console.log('✅ Database connection successful');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  } finally {
    await sql.end();
    process.exit(0);
  }
}

testConnection();
