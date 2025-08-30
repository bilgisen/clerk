// next.config.js
const path = require('path');

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

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  typescript: {
    // We'll handle type checking in CI
    ignoreBuildErrors: false,
    // Enable TypeScript's module resolution
    tsconfigPath: './tsconfig.json',
  },
  eslint: {
    // Only show warnings during build, don't fail the build
    ignoreDuringBuilds: true,
  },
  // Enable experimental features for better module resolution
  experimental: {
    externalDir: true,
  },
  // Configure webpack to handle path aliases
  webpack: (config, { isServer, dev }) => {
    // Add path aliases
    const pathAliases = {
      '@': path.resolve(__dirname, './'),
      '@/components': path.resolve(__dirname, './components'),
      '@/lib': path.resolve(__dirname, './lib'),
      '@/app': path.resolve(__dirname, './app'),
      '@/db': path.resolve(__dirname, './db'),
      '@/hooks': path.resolve(__dirname, './hooks'),
      '@/types': path.resolve(__dirname, './types'),
      '@/middleware': path.resolve(__dirname, './middleware'),
      '@/middleware/old': path.resolve(__dirname, './middleware/old'),
      '@/schemas': path.resolve(__dirname, './schemas')
    };

    // Apply path aliases
    config.resolve.alias = {
      ...config.resolve.alias,
      ...pathAliases
    };

    // Support for TypeScript path aliases
    config.resolve.modules = [
      ...(config.resolve.modules || []),
      path.resolve(__dirname, './')
    ];

    // Support for TypeScript file extensions
    config.resolve.extensions = [
      '.tsx',
      '.ts',
      '.jsx',
      '.js',
      '.mjs',
      '.json',
      '.node'
    ];

    // Fix for dynamic route imports
    if (!isServer) {
      config.resolve.alias['next/dynamic'] = require.resolve('next/dynamic');
    }

    // Handle TypeScript files with .tsx extension
    const tsLoader = {
      test: /\.tsx?$/,
      use: [
        {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
            experimentalWatchApi: true,
            onlyCompileBundledFiles: true,
            compilerOptions: {
              module: 'esnext',
              target: 'es2020',
              jsx: 'preserve',
              moduleResolution: 'node',
              baseUrl: '.',
              paths: {
                '@/*': ['./*'],
                '@/components/*': ['./components/*'],
                '@/lib/*': ['./lib/*'],
                '@/app/*': ['./app/*'],
                '@/db/*': ['./db/*'],
                '@/hooks/*': ['./hooks/*'],
                '@/types/*': ['./types/*'],
                '@/middleware/*': ['./middleware/*'],
                '@/schemas/*': ['./schemas/*']
              }
            }
          }
        }
      ],
      include: [
        path.resolve(__dirname, './components'),
        path.resolve(__dirname, './app'),
        path.resolve(__dirname, './lib'),
        path.resolve(__dirname, './hooks'),
        path.resolve(__dirname, './middleware'),
        path.resolve(__dirname, './schemas'),
        path.resolve(__dirname, './types')
      ]
    };

    // Remove any existing ts-loaders to avoid duplicates
    config.module.rules = config.module.rules.filter(
      rule => !rule.test || !rule.test.toString().includes('tsx?')
    );

    // Add our ts-loader configuration
    config.module.rules.push(tsLoader);

    // Add support for CSS modules
    config.module.rules.push({
      test: /\.css$/i,
      use: ['style-loader', 'css-loader', 'postcss-loader']
    });

    return config;
  },
  
  transpilePackages: [
    '@radix-ui/react-slot',
    'class-variance-authority',
    'clsx',
    'tailwind-merge',
    'tailwindcss-animate',
    'crypto-browserify',
    'stream-browserify',
    'buffer'
  ],
  
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
  
  // Webpack fallback configuration
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
    
    // Add support for .jsx extension for TypeScript files
    config.resolve.extensions = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json', '.node'];
    
    return config;
  },
  
  // Experimental features configuration
  experimental: {
    // Enable TypeScript file extensions in imports
    externalDir: true,
    outputFileTracingRoot: path.join(__dirname, '../../'),
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
  },
};

module.exports = nextConfig;
