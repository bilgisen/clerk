import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Use the DATABASE_URL from environment variables
const connectionString = process.env.DATABASE_URL!;

// Disable prepared statements in development for better performance with connection pooling
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });

export * from './schema';
