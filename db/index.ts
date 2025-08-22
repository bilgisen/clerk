// This is a client-safe re-export file
// Server-side database operations should use @/lib/db/server instead

export * from './schema';

// Client-side safe exports
export const db = new Proxy(
  {},
  {
    get() {
      throw new Error(
        'Direct database access is not allowed from the client. Use API routes instead.'
      );
    },
  }
) as any;
