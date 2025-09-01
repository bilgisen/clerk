import dotenv from 'dotenv';
import path from 'path';
import { auth } from '@/lib/auth/better-auth';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Set required environment variables if not already set
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://neondb_owner:npg_WBGaS6d7vtbA@ep-lingering-grass-a2xxclbr-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require';
process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_URL_UNPOOLED || 'postgresql://neondb_owner:npg_WBGaS6d7vtbA@ep-lingering-grass-a2xxclbr.eu-central-1.aws.neon.tech/neondb?sslmode=require';
process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || 'ulq4H7O5gs28tlKsItdjstz';
process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://editor.bookshall.com';
process.env.AUTH_URL = process.env.AUTH_URL || 'https://editor.bookshall.com';

async function testAuth() {
  try {
    console.log('Testing Better Auth configuration...');
    
    // Check if auth is properly initialized
    console.log('Auth methods:', Object.keys(auth));
    
    // Test session endpoint
    console.log('\nTesting session endpoint...');
    const session = await auth.getSession();
    console.log('Session:', session);
    
    // Test Google sign-in URL
    console.log('\nGenerating Google sign-in URL...');
    const signInUrl = await auth.getSignInUrl('google');
    console.log('Google Sign-in URL:', signInUrl);
    
    console.log('\n✅ Better Auth configuration looks good!');
  } catch (error) {
    console.error('❌ Error testing Better Auth:', error);
    process.exit(1);
  }
}

testAuth();
