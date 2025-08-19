// next.config.ts

import type { NextConfig } from 'next';

const clerkConfig = {
  // Production Clerk domain
  domain: 'clerk.editor.bookshall.com',
  // Development domain (uncomment when needed)
  // domain: 'clerk.snappy.dog-14.lcl.dev'
};

const nextConfig: NextConfig = {
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Clerk configuration
  env: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CLERK_FRONTEND_API: clerkConfig.domain,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-6f0cf05705c7412b93a792350f3b3aa5.r2.dev',
      },
      {
        protocol: 'https',
        hostname: 'jdj14ctwppwprnqu.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: 'image.eventmice.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;