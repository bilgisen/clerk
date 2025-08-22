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
  
  // Add security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
  
  // Webpack configuration to handle Node.js core modules
  webpack: (config, { isServer }) => {
    // Only apply these changes for client-side bundles
    if (!isServer) {
      // Set fallbacks for Node.js core modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        fs: false,
        dns: false,
        http2: false,
        child_process: false,
        dgram: false,
        zlib: false,
      };
    }
    return config;
  },

  // Environment variables
  env: {
    // Clerk configuration
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CLERK_FRONTEND_API: clerkConfig.domain,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: '/sign-in',
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: '/sign-up',
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: '/dashboard',
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: '/dashboard',
    NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL: '/dashboard',
    NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL: '/dashboard',
    CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET,
    
    // R2 Configuration
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
    R2_UPLOAD_IMAGE_ACCESS_KEY_ID: process.env.R2_UPLOAD_IMAGE_ACCESS_KEY_ID,
    R2_UPLOAD_IMAGE_SECRET_ACCESS_KEY: process.env.R2_UPLOAD_IMAGE_SECRET_ACCESS_KEY,
    R2_UPLOAD_IMAGE_BUCKET_NAME: process.env.R2_UPLOAD_IMAGE_BUCKET_NAME,
    NEXT_PUBLIC_IMAGE_BASE_URL: process.env.NEXT_PUBLIC_IMAGE_BASE_URL,
    NEXT_PUBLIC_MEDIA_BASE_URL: process.env.NEXT_PUBLIC_MEDIA_BASE_URL
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-6f0cf05705c7412b93a792350f3b3aa5.r2.dev',
      },
      {
        protocol: 'https',
        hostname: 'storage.bookshall.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
      {
        protocol: 'https',
        hostname: '*.clerk.accounts.dev',
      },
    ],
    // Allow unoptimized images for Cloudflare R2
    unoptimized: true,
  },
};

export default nextConfig;