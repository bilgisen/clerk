// This script loads environment variables before importing anything else
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file first
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Set required environment variables if not already set
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://neondb_owner:npg_WBGaS6d7vtbA@ep-lingering-grass-a2xxclbr-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require';
process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_URL_UNPOOLED || 'postgresql://neondb_owner:npg_WBGaS6d7vtbA@ep-lingering-grass-a2xxclbr.eu-central-1.aws.neon.tech/neondb?sslmode=require';
process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || 'ulq4H7O5gs28tlKsItdjstz';
process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://editor.bookshall.com';
process.env.AUTH_URL = process.env.AUTH_URL || 'https://editor.bookshall.com';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Log the environment variables we're using
console.log('Environment variables set:');
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? '***' : 'Not set');
console.log('- DATABASE_URL_UNPOOLED:', process.env.DATABASE_URL_UNPOOLED ? '***' : 'Not set');
console.log('- BETTER_AUTH_SECRET:', process.env.BETTER_AUTH_SECRET ? '***' : 'Not set');
console.log('- NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);
console.log('- AUTH_URL:', process.env.AUTH_URL);
console.log('- NODE_ENV:', process.env.NODE_ENV);

// Import the test script after setting up environment variables
import('./test-better-auth.ts').catch(console.error);
