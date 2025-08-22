import 'server-only';

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';

// This file should only be imported in server components or API routes

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in environment variables');
}

// Create a single connection to the database
const client = postgres(process.env.DATABASE_URL, { 
  prepare: false,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export const db = drizzle(client, { schema });

export async function getDb() {
  return db;
}

// Add any server-only database utilities here
