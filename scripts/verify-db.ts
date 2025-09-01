import { db } from '@/db';
import { sql } from 'drizzle-orm';

async function verifyDatabase() {
  try {
    console.log('🔍 Verifying database connection...');
    
    // 1. Test connection
    const testQuery = await db.execute(sql`SELECT 1 as test`);
    console.log('✅ Database connection successful:', testQuery[0]);

    // 2. Check users table
    console.log('\n🔍 Checking users table...');
    const users = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    console.log('📋 Users table columns:');
    console.table(users);

    // 3. Check sessions table
    console.log('\n🔍 Checking sessions table...');
    const sessions = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'sessions'
      ORDER BY ordinal_position
    `);
    console.log('📋 Sessions table columns:');
    console.table(sessions);

    // 4. Check verification_tokens table
    console.log('\n🔍 Checking verification_tokens table...');
    const verificationTokens = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'verification_tokens'
      ORDER BY ordinal_position
    `);
    console.log('📋 Verification tokens table columns:');
    console.table(verificationTokens);

    // 5. Try to query users
    console.log('\n🔍 Testing users query...');
    const userCount = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
    console.log('✅ Users count:', userCount[0]);

    return true;
  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...(error as any).cause ? { cause: (error as any).cause } : {}
      });
    }
    return false;
  } finally {
    // Close the database connection
    // Note: In a real app, you'd want to manage the connection pool properly
    // await db.end();
  }
}

// Run the verification
verifyDatabase()
  .then(success => {
    console.log(success ? '\n✅ Verification completed successfully' : '\n❌ Verification failed');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
