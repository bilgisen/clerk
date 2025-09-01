import { db } from '@/db';
import { sql } from 'drizzle-orm';

async function checkDbTables() {
  try {
    console.log('🔍 Checking database connection...');
    
    // Test raw SQL query
    const result = await db.execute(sql`SELECT 1 as test`);
    console.log('✅ Database connection successful:', result[0]);

    // Check users table
    console.log('\n🔍 Checking users table...');
    try {
      const users = await db.execute(sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `);
      console.log('✅ Users table columns:');
      console.table(users);
    } catch (error) {
      console.error('❌ Error checking users table:', error);
    }

    // Check sessions table
    console.log('\n🔍 Checking sessions table...');
    try {
      const sessions = await db.execute(sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'sessions'
        ORDER BY ordinal_position
      `);
      console.log('✅ Sessions table columns:');
      console.table(sessions);
    } catch (error) {
      console.error('❌ Error checking sessions table:', error);
    }

    // Check verification_tokens table
    console.log('\n🔍 Checking verification_tokens table...');
    try {
      const verificationTokens = await db.execute(sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'verification_tokens'
        ORDER BY ordinal_position
      `);
      console.log('✅ Verification tokens table columns:');
      console.table(verificationTokens);
    } catch (error) {
      console.error('❌ Error checking verification_tokens table:', error);
    }

  } catch (error) {
    console.error('❌ Database test failed:', error);
    process.exit(1);
  }
}

checkDbTables();
