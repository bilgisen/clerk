import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Use direct connection for better compatibility with Drizzle
const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL or DATABASE_URL_UNPOOLED environment variable is not set');
}

export const sql = postgres(connectionString, {
  ssl: 'require',
  max: 10, // Connection pool size
  idle_timeout: 20,
  max_lifetime: 60 * 30, // 30 minutes
});

export const db = drizzle(sql);

// Re-export schema for convenience
export * from './schema';
