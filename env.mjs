// This file is used to provide TypeScript types for environment variables
// It's safe to commit this file as it only contains type definitions

// @ts-check
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    // Database
    DATABASE_URL: z.string().url(),
    
    // Authentication
    CLERK_SECRET_KEY: z.string().min(1),
    GHA_OIDC_AUDIENCE: z.string().url().default('https://editor.bookshall.com/api/ci'),
    
    // Polar.sh
    POLAR_ACCESS_TOKEN: z.string().min(1).optional(),
    POLAR_WEBHOOK_SECRET: z.string().min(1).optional(),
    
    // R2 Storage
    R2_UPLOAD_IMAGE_ACCESS_KEY_ID: z.string().min(1),
    R2_UPLOAD_IMAGE_SECRET_ACCESS_KEY: z.string().min(1),
    R2_UPLOAD_IMAGE_BUCKET_NAME: z.string().min(1),
    CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
    
    // Other environment variables
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  },
  
  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // Clerk
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
    
    // Polar.sh
    NEXT_PUBLIC_POLAR_API_URL: z.string().url().default("https://api.polar.sh"),
    NEXT_PUBLIC_POLAR_PRICE_STARTER: z.string().optional(),
    NEXT_PUBLIC_POLAR_PRICE_PRO: z.string().optional(),
  },
  
  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtime (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    // Server
    DATABASE_URL: process.env.DATABASE_URL,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    GHA_OIDC_AUDIENCE: process.env.GHA_OIDC_AUDIENCE,
    
    // R2 Storage
    R2_UPLOAD_IMAGE_ACCESS_KEY_ID: process.env.R2_UPLOAD_IMAGE_ACCESS_KEY_ID,
    R2_UPLOAD_IMAGE_SECRET_ACCESS_KEY: process.env.R2_UPLOAD_IMAGE_SECRET_ACCESS_KEY,
    R2_UPLOAD_IMAGE_BUCKET_NAME: process.env.R2_UPLOAD_IMAGE_BUCKET_NAME,
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
    POLAR_ACCESS_TOKEN: process.env.POLAR_ACCESS_TOKEN,
    POLAR_WEBHOOK_SECRET: process.env.POLAR_WEBHOOK_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    
    // Client
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_POLAR_API_URL: process.env.NEXT_PUBLIC_POLAR_API_URL,
    NEXT_PUBLIC_POLAR_PRICE_STARTER: process.env.NEXT_PUBLIC_POLAR_PRICE_STARTER,
    NEXT_PUBLIC_POLAR_PRICE_PRO: process.env.NEXT_PUBLIC_POLAR_PRICE_PRO,
  },
  
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
   * This is especially useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  
  /**
   * Makes it so that empty strings are treated as undefined.
   * `SOME_VAR: z.string()` and `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
