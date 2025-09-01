import 'dotenv/config';
import { auth } from '@/lib/auth/better-auth';
import { db } from '@/db';

async function verifyAuthConfig() {
  console.log('Verifying auth configuration...');
  
  try {
    // Check if auth object has required properties
    console.log('Checking auth object structure...');
    
    // Check if database is connected
    console.log('Checking database connection...');
    await db.select().from(db.users).limit(1);
    
    // Check if auth has expected properties
    const expectedProps = [
      'database',
      'socialProviders',
      'plugins',
      'emailAndPassword',
      'session',
      'callbacks'
    ];
    
    for (const prop of expectedProps) {
      if (!(prop in auth)) {
        throw new Error(`Missing required auth property: ${prop}`);
      }
    }
    
    // Check if Google provider is configured
    if (!auth.socialProviders?.google) {
      throw new Error('Google provider is not properly configured');
    }
    
    // Check if required callbacks are present
    const requiredCallbacks = [
      'signIn',
      'session'
    ];
    
    for (const callback of requiredCallbacks) {
      if (typeof auth.callbacks[callback] !== 'function') {
        throw new Error(`Missing required callback: ${callback}`);
      }
    }
    
    console.log('✅ Auth configuration is valid');
    console.log('\nAuth configuration:');
    console.log('- Database:', auth.database.adapter);
    console.log('- Social Providers:', Object.keys(auth.socialProviders || {}));
    console.log('- Callbacks:', Object.keys(auth.callbacks || {}));
    console.log('- Session Config:', auth.session);
    
  } catch (error) {
    console.error('❌ Error verifying auth configuration:');
    if (error instanceof Error) {
      console.error(error.message);
      if (error.stack) {
        console.error(error.stack.split('\n').slice(0, 3).join('\n'));
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

verifyAuthConfig();
