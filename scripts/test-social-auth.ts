import 'dotenv/config';
import { auth } from '@/lib/auth/better-auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Verify required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

async function testSocialAuth() {
  console.log('Testing social auth flow...');

  // Simulate a social auth user
  const mockSocialUser = {
    email: `test-social-${Date.now()}@example.com`,
    name: 'Social User',
    image: 'https://example.com/avatar.jpg'
  };

  try {
    // Test the auth handler directly
    console.log('Testing auth handler...');
    
    // Simulate a social auth callback
    const authResponse = await auth.handler({
      method: 'POST',
      url: '/api/auth/callback/google',
      body: {
        code: 'test-code',
        state: 'test-state'
      },
      headers: {
        'content-type': 'application/json'
      }
    });

    console.log('Auth response status:', authResponse.status);
    
    // Check if user was created
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, mockSocialUser.email))
      .limit(1);

    if (!dbUser) {
      throw new Error('User was not created in the database');
    }

    console.log('User created successfully:', {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      isActive: dbUser.isActive
    });

    // Test getting the session
    console.log('\nTesting session retrieval...');
    const sessionResponse = await auth.handler({
      method: 'GET',
      url: '/api/auth/session',
      headers: {
        cookie: authResponse.headers.get('set-cookie') || ''
      }
    });

    const session = await sessionResponse.json();
    console.log('Session data:', session);

    console.log('Session data:', {
      user: {
        id: session.user?.id,
        email: session.user?.email,
        role: session.user?.role
      },
      expires: session.expires
    });

    console.log('\n✅ Social auth flow test completed successfully');
  } catch (error) {
    console.error('❌ Error testing social auth flow:', error);
    process.exit(1);
  }
}

testSocialAuth();
