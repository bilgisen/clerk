import { config } from "dotenv";
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

// Load environment variables
config({ path: ".env" });

// Create a simple Neon HTTP client
const sql = neon(process.env.DATABASE_URL!);

// Initialize Drizzle with the connection
const db = drizzle(sql, { 
  schema,
  logger: process.env.NODE_ENV === 'development'
});

export { db };
