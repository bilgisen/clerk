import { db } from '@/db';
import { sql } from 'drizzle-orm';

// Define proper types for database query results
type TableInfo = {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
};

type TableList = { table_name: string }[];
type TestResult = { test: number }[];
type CountResult = { count: number }[];

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...');
    
    // 1. Test raw SQL query
    console.log('\n1. Testing raw SQL query...');
    const result = await db.execute<TestResult>(sql`SELECT 1 as test`);
    console.log('✅ Raw query result:', result[0]);
    
    // 2. List all tables in public schema
    console.log('\n2. Listing all tables in public schema...');
    const tables = await db.execute<TableList>(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('📋 Tables in public schema:');
    tables.forEach(row => console.log(`   - ${row.table_name}`));
    
    // 3. Check auth-related tables
    console.log('\n3. Checking auth tables structure...');
    
    for (const table of ['users', 'sessions', 'verification_tokens']) {
      console.log(`\n🔍 Checking ${table} table...`);
      try {
        const columns = await db.execute<TableInfo>(sql`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = ${table}
          ORDER BY ordinal_position
        `);
        
        console.log(`✅ ${table} table columns:`);
        columns.forEach((col: TableInfo) => {
          console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });
        
        // Count rows if table exists
        const count = await db.execute<CountResult>(sql`
          SELECT COUNT(*) as count FROM ${sql.identifier(table)}
        `);
        console.log(`   📊 Row count: ${count[0]?.count || 0}`);
      } catch (error) {
        if (error instanceof Error && error.message.includes('count')) {
          console.log('   ℹ️ Could not count rows:', error.message);
        } else {
          console.error(`❌ Error checking ${table} table:`, error instanceof Error ? error.message : 'Unknown error');
        }
      }
    }
    
    console.log('\n✅ Database connection test completed successfully');
  } catch (error) {
    console.error('❌ Database test failed:', error instanceof Error ? error.message : 'Unknown error');
    if (error instanceof Error && 'stack' in error) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    // Don't close the connection as it's managed by the application
    process.exit(0);
  }
}

testConnection();
