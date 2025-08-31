import { defineConfig } from 'better-auth/cli';
import { db } from './db';

export default defineConfig({
  database: db,
  migrations: {
    tableName: 'auth_migrations',
    directory: './migrations/auth',
  },
});
