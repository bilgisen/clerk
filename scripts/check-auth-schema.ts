import { db } from '@/db';
import { sql } from 'drizzle-orm';

async function checkAuthSchema() {
  console.log('Checking auth schema and database connection...');

  try {
    // 1. Check if users table exists and has required columns
    console.log('\n🔍 Checking users table...');
    const userColumns = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public'
    `);
    console.log('Users table columns:', userColumns.rows);

    // 2. Check if sessions table exists
    console.log('\n🔍 Checking sessions table...');
    const sessionColumns = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sessions' AND table_schema = 'public'
    `);
    console.log('Sessions table columns:', sessionColumns.rows);

    // 3. Check if verification_tokens table exists
    console.log('\n🔍 Checking verification_tokens table...');
    const tokenColumns = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'verification_tokens' AND table_schema = 'public'
    `);
    console.log('Verification tokens table columns:', tokenColumns.rows);

    // 4. Test a simple query on users table using raw SQL
    console.log('\n🔍 Testing users table query...');
    const userCount = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
    console.log(`Found ${userCount.rows[0].count} users in the database`);

    console.log('\n✅ Auth schema check completed successfully');
  } catch (error) {
    console.error('❌ Error checking auth schema:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

// Run the check
checkAuthSchema().catch(console.error);
