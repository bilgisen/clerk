// This file ensures TypeScript recognizes Node.js global types
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      REVALIDATION_SECRET?: string;
      NEXT_PUBLIC_REVALIDATION_SECRET?: string;
      // Add other environment variables here as needed
    }
  }
}

export {};
