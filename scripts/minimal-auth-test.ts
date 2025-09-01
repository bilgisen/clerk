import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db';
import { users } from '@/db/schema';
import { sessions, verificationTokens } from '@/db/schema/auth';

async function testMinimalAuth() {
  try {
    console.log('🔍 Creating minimal auth instance...');
    
    // Create a minimal auth instance
    const auth = betterAuth({
      secret: process.env.BETTER_AUTH_SECRET!,
      database: {
        adapter: drizzleAdapter(db, {
          users: {
            ...users,
            id: users.id,
            email: users.email,
            emailVerified: users.emailVerified,
            name: users.firstName,
            image: users.imageUrl,
            password: users.passwordHash,
          },
          sessions,
          verificationTokens,
          options: {
            provider: 'pg',
          },
        }),
      },
    });

    console.log('✅ Auth instance created successfully');
    return true;
  } catch (error) {
    console.error('❌ Error creating auth instance:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        ...(error as any).cause ? { cause: (error as any).cause } : {}
      });
    }
    return false;
  }
}

// Run the test
testMinimalAuth()
  .then(success => {
    console.log(success ? '\n✅ Test completed successfully' : '\n❌ Test failed');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
