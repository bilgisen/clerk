import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db';
import { users } from '@/db/schema';
import { sessions, verificationTokens } from '@/db/schema/auth';

async function testAuth() {
  try {
    console.log('🔍 Testing auth configuration...');
    
    // 1. Test database connection
    console.log('\n1. Testing database connection...');
    const testQuery = await db.execute(`SELECT 1 as test`);
    console.log('✅ Database connection successful:', testQuery[0]);

    // 2. Test auth initialization
    console.log('\n2. Initializing auth...');
    const auth = betterAuth({
      secret: process.env.BETTER_AUTH_SECRET!,
      database: {
        adapter: {
          name: 'drizzle',
          client: db,
          tables: {
            users: {
              ...users,
              id: users.id,
              email: users.email,
              password: users.passwordHash,
              emailVerified: users.emailVerified,
              name: users.firstName,
              image: users.imageUrl,
            },
            sessions,
            verificationTokens,
          },
          options: {
            provider: 'pg',
          },
        },
      },
    });
    
    console.log('✅ Auth instance created successfully');
    return true;
  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      if ('stack' in error) {
        console.error('Stack trace:', error.stack);
      }
      if ('cause' in error) {
        console.error('Cause:', error.cause);
      }
    }
    return false;
  }
}

// Run the test
testAuth()
  .then(success => {
    console.log(success ? '\n✅ Test completed successfully' : '\n❌ Test failed');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
