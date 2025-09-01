import 'dotenv/config';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

// Log environment variables for debugging
console.log('Environment variables:');
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? '***' : 'Not set');
console.log('- DATABASE_URL_UNPOOLED:', process.env.DATABASE_URL_UNPOOLED ? '***' : 'Not set');
console.log('- BETTER_AUTH_SECRET:', process.env.BETTER_AUTH_SECRET ? '***' : 'Not set');
console.log('- NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);
console.log('- AUTH_URL:', process.env.AUTH_URL);
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '***' : 'Not set');
console.log('- GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '***' : 'Not set');

async function verifyAuthSetup() {
  console.log('\n🔍 Verifying database connection...');
  
  try {
    // 1. Test raw database connection
    console.log('\n1. Testing database connection...');
    const result = await db.execute(sql`SELECT 1 as test`);
    console.log('✅ Database connection successful:', result.rows[0]);
    
    // 2. List all tables in the database
    console.log('\n2. Checking database tables...');
    const tables = await db.execute<{table_name: string}>(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📋 Tables in public schema:');
    const tableNames = tables.rows.map(t => t.table_name);
    tableNames.forEach(name => console.log(`   - ${name}`));
    
    // 3. Check for required auth tables
    console.log('\n3. Verifying required auth tables...');
    const requiredTables = ['users', 'sessions', 'verification_tokens'];
    const missingTables = requiredTables.filter(t => !tableNames.includes(t));
    
    if (missingTables.length === 0) {
      console.log('✅ All required auth tables exist');
    } else {
      console.error(`❌ Missing required tables: ${missingTables.join(', ')}`);
      console.log('   Run database migrations to create the missing tables');
    }
    
    // 4. Check users table structure
    if (tableNames.includes('users')) {
      console.log('\n4. Checking users table structure...');
      const userColumns = await db.execute<{column_name: string, data_type: string}>(sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `);
      
      console.log('📋 Users table columns:');
      userColumns.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type}`);
      });
      
      // Check for required columns
      const requiredColumns = ['id', 'email', 'name'];
      const columnNames = userColumns.rows.map(c => c.column_name);
      const missingColumns = requiredColumns.filter(c => !columnNames.includes(c));
      
      if (missingColumns.length === 0) {
        console.log('✅ All required columns exist in users table');
      } else {
        console.error(`❌ Missing required columns: ${missingColumns.join(', ')}`);
      }
      
      // Count users
      const userCount = await db.execute<{count: string}>(sql`
        SELECT COUNT(*) as count FROM users
      `);
      console.log(`   Total users: ${userCount.rows[0]?.count || 0}`);
    }
    
    // 5. Check environment variables
    console.log('\n5. Verifying environment variables...');
    const requiredVars = [
      'DATABASE_URL',
      'DATABASE_URL_UNPOOLED',
      'BETTER_AUTH_SECRET',
      'NEXT_PUBLIC_APP_URL',
      'AUTH_URL',
      'NODE_ENV',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET'
    ];
    
    let allVarsPresent = true;
    for (const varName of requiredVars) {
      const isSet = process.env[varName] ? '✅' : '❌';
      console.log(`   ${isSet} ${varName}: ${process.env[varName] ? '***' : 'Not set'}`);
      if (!process.env[varName]) allVarsPresent = false;
    }
    
    if (allVarsPresent) {
      console.log('✅ All required environment variables are set');
    } else {
      console.log('❌ Some required environment variables are missing');
    }
    console.log('\n✅ Setup verification completed');
    return true;
    
    const requiredGoogleConfig = ['clientId', 'clientSecret'];
    for (const key of requiredGoogleConfig) {
      if (!auth.socialProviders.google[key]) {
        throw new Error(`Missing required Google OAuth configuration: ${key}`);
      }
    }
    console.log('✅ Google OAuth is properly configured');

    // 5. Verify callbacks
    console.log('\n🔍 Verifying auth callbacks...');
    const requiredCallbacks = ['signIn', 'session'];
    for (const callback of requiredCallbacks) {
      if (typeof auth.callbacks[callback] !== 'function') {
        throw new Error(`Missing required callback: ${callback}`);
      }
    }
    console.log('✅ All required callbacks are present');

    console.log('\n🎉 Auth setup is valid and ready to use!');
  } catch (error) {
    console.error('\n❌ Auth setup verification failed:');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run the verification
verifyAuthSetup();
