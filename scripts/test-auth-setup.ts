import { auth } from '@/lib/auth/better-auth';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

async function testAuthSetup() {
  console.log('🔍 Testing auth setup...');

  try {
    // 1. Check if auth instance is properly initialized
    console.log('\n1. Checking auth instance...');
    if (!auth) {
      throw new Error('Auth instance is not properly initialized');
    }
    console.log('✅ Auth instance is properly initialized');

    // 2. Test database connection through auth
    console.log('\n2. Testing database connection...');
    const result = await db.execute(sql`SELECT 1 as test`);
    console.log('✅ Database connection successful:', result[0]);

    // 3. Check if required tables exist
    console.log('\n3. Checking required auth tables...');
    const tables = await db.execute<{table_name: string}>(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name IN ('users', 'sessions', 'verification_tokens')
      ORDER BY table_name
    `);

    const requiredTables = ['users', 'sessions', 'verification_tokens'];
    const foundTables = tables.map(t => t.table_name);
    const missingTables = requiredTables.filter(t => !foundTables.includes(t));

    if (missingTables.length === 0) {
      console.log('✅ All required auth tables exist');
    } else {
      throw new Error(`Missing required tables: ${missingTables.join(', ')}`);
    }

    // 4. Check if we can query users
    console.log('\n4. Testing users table access...');
    const users = await db.execute<{count: number}>(sql`
      SELECT COUNT(*) as count FROM users
    `);
    console.log(`✅ Successfully queried users table (${users[0]?.count || 0} users found)`);

    console.log('\n✅ Auth setup test completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Auth setup test failed:', error instanceof Error ? error.message : 'Unknown error');
    if (error instanceof Error && 'stack' in error) {
      console.error('Stack trace:', error.stack);
    }
    return false;
  }
}

// Run the test
testAuthSetup()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
