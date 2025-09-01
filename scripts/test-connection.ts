import { sql } from '../db';

async function testConnection() {
  try {
    console.log('Testing database connection...');
    const result = await sql`SELECT version()`;
    console.log('✅ Database connection successful!');
    console.log('PostgreSQL version:', result[0]?.version || 'Unknown');
    
    // Test if tables exist
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `;
    
    console.log('\nAvailable tables:');
    console.table(tables);
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error(error);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

testConnection();
