const path = require("path");

// Required for Edge Runtime
if (!process.env.NEXT_RUNTIME) {
  globalThis.crypto = require("crypto").webcrypto;
}

// Better Auth configuration
const authConfig = {
  // Add any auth-specific configuration here if needed
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable source maps in production for better error tracking
  productionBrowserSourceMaps: true,
  
  // Enable React's Strict Mode
  reactStrictMode: false,
  
  // Configure webpack to handle Node.js built-in modules
  webpack: (config, { isServer, isEdgeRuntime }) => {
    // Don't include certain modules in the client bundle or Edge Runtime
    if (!isServer || isEdgeRuntime) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
        pg: false,
        'pg-native': false,
        'pg-query-stream': false,
        'pg-protocol': false,
        // AWS SDK dependencies
        '@aws-sdk/credential-providers': false,
        '@aws-sdk/client-s3': false,
        'aws-sdk': false,
        // Other problematic modules
        'drizzle-orm': false,
        'drizzle-orm/node-postgres': false,
      };
    }
    
    // Exclude certain modules from being processed by webpack
    if (isEdgeRuntime) {
      config.externals = config.externals || [];
      config.externals.push(
        'better-auth',
        'pg',
        'drizzle-orm',
        'drizzle-orm/node-postgres'
      );
    }
    
    return config;
  },

  typescript: {
    ignoreBuildErrors: false,
    tsconfigPath: "./tsconfig.json",
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  transpilePackages: [
    "@radix-ui/react-slot",
    "class-variance-authority",
    "clsx",
    "tailwind-merge",
    "tailwindcss-animate",
    "crypto-browserify",
    "stream-browserify",
    "buffer",
  ],

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
        ],
      },
    ];
  },

  webpack: (config, { isServer }) => {
    // ---- Path aliases ----
    const pathAliases = {
      "@": path.resolve(__dirname, "./"),
      "@/components": path.resolve(__dirname, "./components"),
      "@/lib": path.resolve(__dirname, "./lib"),
      "@/app": path.resolve(__dirname, "./app"),
      "@/db": path.resolve(__dirname, "./db"),
      "@/hooks": path.resolve(__dirname, "./hooks"),
      "@/types": path.resolve(__dirname, "./types"),
      "@/middleware": path.resolve(__dirname, "./middleware"),
      "@/schemas": path.resolve(__dirname, "./schemas"),
    };

    config.resolve.alias = { ...config.resolve.alias, ...pathAliases };

    config.resolve.modules = [
      ...(config.resolve.modules || []),
      path.resolve(__dirname, "./"),
    ];

    config.resolve.extensions = [
      ".tsx",
      ".ts",
      ".jsx",
      ".js",
      ".mjs",
      ".json",
      ".node",
    ];

    // Dynamic route imports fix
    if (!isServer) {
      config.resolve.alias["next/dynamic"] = require.resolve("next/dynamic");
    }

    // ---- ts-loader ----
    const tsLoader = {
      test: /\.tsx?$/,
      use: [
        {
          loader: "ts-loader",
          options: {
            transpileOnly: true,
            experimentalWatchApi: true,
            onlyCompileBundledFiles: true,
            compilerOptions: {
              module: "esnext",
              target: "es2020",
              jsx: "preserve",
              moduleResolution: "node",
              baseUrl: ".",
              paths: {
                "@/*": ["./*"],
                "@/components/*": ["./components/*"],
                "@/lib/*": ["./lib/*"],
                "@/app/*": ["./app/*"],
                "@/db/*": ["./db/*"],
                "@/hooks/*": ["./hooks/*"],
                "@/types/*": ["./types/*"],
                "@/middleware/*": ["./middleware/*"],
                "@/schemas/*": ["./schemas/*"],
              },
            },
          },
        },
      ],
      include: [
        path.resolve(__dirname, "./components"),
        path.resolve(__dirname, "./app"),
        path.resolve(__dirname, "./lib"),
        path.resolve(__dirname, "./hooks"),
        path.resolve(__dirname, "./middleware"),
        path.resolve(__dirname, "./schemas"),
        path.resolve(__dirname, "./types"),
      ],
    };

    config.module.rules = config.module.rules.filter(
      (rule) => !rule.test || !rule.test.toString().includes("tsx?")
    );
    config.module.rules.push(tsLoader);

    // ---- CSS loader ----
    config.module.rules.push({
      test: /\.css$/i,
      use: ["style-loader", "css-loader", "postcss-loader"],
    });

    // ---- Polyfills / fallbacks ----
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: require.resolve("crypto-browserify"),
        stream: require.resolve("stream-browserify"),
        buffer: require.resolve("buffer/"),
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

  experimental: {
    externalDir: true,
    // Ensure server components are properly marked
    serverComponentsExternalPackages: [
      'better-auth', 
      'pg', 
      'drizzle-orm', 
      'drizzle-orm/node-postgres',
      '@aws-sdk/credential-providers',
      '@aws-sdk/client-s3'
    ],
  },
  
  // Configure which pages should use Edge Runtime
  experimental: {
    runtime: 'nodejs',
    serverComponents: true,
    concurrentFeatures: false,
  },

  env: {
    REDIS_URL: process.env.REDIS_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BASE_URL: process.env.BASE_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  },
};

module.exports = nextConfig;
