// Type definitions for modules without @types

// Tree View Components
declare module '@/components/tree-view' {
  export interface TreeViewItem {
    id: string;
    name: string;
    children?: TreeViewItem[];
    order?: number;
    level?: number;
    parent_chapter_id?: string | null;
    [key: string]: any; // Allow additional properties
  }
}

// Authentication
declare module '@/lib/auth/verifySecret' {
  export function verifySecretToken(token: string): Promise<boolean>;
}

// CSS Modules
declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { [key: string]: string };
  export default classes;
}

// Environment Configuration
declare module '@t3-oss/env-nextjs' {
  export function createEnv<T extends Record<string, unknown>>(
    config: any
  ): T;
}

// Global Type Augmentations
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Node Environment
      NODE_ENV: 'development' | 'production' | 'test';
      
      // Clerk Authentication
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: string;
      CLERK_SECRET_KEY: string;
      
      // Database
      DATABASE_URL: string;
      
      // Redis
      REDIS_URL: string;
      
      // GitHub OAuth
      GITHUB_CLIENT_ID: string;
      GITHUB_CLIENT_SECRET: string;
      
      // Next.js Configuration
      NEXT_PUBLIC_APP_URL: string;
    }
  }
  
  // Add any global type extensions here
  interface Window {
    // Add any browser globals here if needed
  }
}
