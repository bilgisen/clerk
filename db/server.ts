// db/server.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Postgres client
const client = postgres(process.env.DATABASE_URL!, {
  ssl: process.env.NODE_ENV === "production" ? "require" : false,
  max: 1, // tek bağlantı, serverless ortam için güvenli
});

// Drizzle ORM instance
export const db = drizzle(client, { schema });
