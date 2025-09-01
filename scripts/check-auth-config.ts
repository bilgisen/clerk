import 'dotenv/config';
import { auth } from '@/lib/auth/better-auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { BetterAuth } from 'better-auth';

async function checkAuthConfig() {
  console.log('🔍 Checking auth configuration...');
  
  try {
    // 1. Check if environment variables are set
    console.log('\n🔧 Environment Variables:');
    const requiredEnvVars = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'DATABASE_URL',
      'DATABASE_URL_UNPOOLED'
    ];

    for (const envVar of requiredEnvVars) {
      const value = process.env[envVar];
      console.log(`${envVar}: ${value ? '✅ Set' : '❌ Missing'}`);
      if (!value) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }

    // 2. Test database connection
    console.log('\n🔌 Testing database connection...');
    try {
      const result = await db.select().from(users).limit(1);
      console.log(`✅ Database connection successful (found ${result.length} users)`);
    } catch (error) {
      console.error('❌ Database connection failed:', error instanceof Error ? error.message : error);
      throw error;
    }

    // 3. Check auth instance
    console.log('\n🔒 Checking auth instance...');
    if (!auth) {
      throw new Error('Auth instance is not properly initialized');
    }
    console.log('✅ Auth instance is properly initialized');

    // 4. Check if auth has required methods
    console.log('\n🔍 Checking auth methods...');
    
    // Check handler
    if (typeof auth.handler !== 'function') {
      throw new Error('Missing required auth method: handler');
    }
    console.log('✅ Method handler is available');
    
    // Check if auth has the expected API methods through the handler
    if (auth.api && typeof auth.api === 'object') {
      console.log('✅ Auth API methods are available');
      
      // Check for specific API endpoints if needed
      const apiMethods = ['signIn', 'signOut', 'session'];
      for (const method of apiMethods) {
        if (auth.api[method]) {
          console.log(`✅ API endpoint ${method} is available`);
        } else {
          console.warn(`⚠️  API endpoint ${method} is not available`);
        }
      }
    } else {
      console.warn('⚠️  Auth API methods are not available');
    }

    console.log('\n🎉 Auth configuration is valid and ready to use!');
  } catch (error) {
    console.error('\n❌ Auth configuration check failed:');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

checkAuthConfig();
