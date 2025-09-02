import { drizzle } from 'drizzle-orm/neon-http';

// Get connection string from env
const connectionString = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create Drizzle instance with the connection string
export const db = drizzle(connectionString);

// Re-export schema for convenience
export * from './schema';
