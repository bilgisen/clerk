// next.config.ts

import type { NextConfig } from 'next';

// Required for Edge Runtime
if (!process.env.NEXT_RUNTIME) {
  globalThis.crypto = require('crypto').webcrypto;
}

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
  eslint: {
    // Only show warnings during build, don't fail the build
    ignoreDuringBuilds: true,
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
  
  // Webpack configuration
  webpack: (config, { isServer }) => {
    // Only apply these changes for client-side bundles
    if (!isServer) {
      // Set fallbacks for Node.js core modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        // Crypto and related polyfills
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer/'),
        // Disable other Node.js core modules
        net: false,
        tls: false,
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
  
  // Experimental features configuration
  experimental: {
    // Enable server actions with allowed origins
    serverActions: {
      bodySizeLimit: '2mb',
      allowedOrigins: [
        'localhost:3000',
        'editor.bookshall.com',
        'clerk.editor.bookshall.com',
      ],
    },
  },

  // Environment variables
  env: {
    // Clerk configuration
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    
    // JWT Configuration
    COMBINED_JWT_PRIVATE_KEY: process.env.COMBINED_JWT_PRIVATE_KEY,
    COMBINED_JWT_PUBLIC_KEY: process.env.COMBINED_JWT_PUBLIC_KEY,
    COMBINED_JWT_AUD: process.env.COMBINED_JWT_AUD || 'clerk-js',
    
    // Redis Configuration
    REDIS_URL: process.env.REDIS_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
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