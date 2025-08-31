const path = require("path");

// Required for Edge Runtime
if (!process.env.NEXT_RUNTIME) {
  globalThis.crypto = require("crypto").webcrypto;
}

const clerkConfig = {
  domain: "clerk.editor.bookshall.com",
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,

  typescript: {
    // CI'de type check yapılacak
    ignoreBuildErrors: false,
    tsconfigPath: "./tsconfig.json",
  },

  eslint: {
    // Build'i kırma, sadece warning göster
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

  webpack: (config, { isServer, dev }) => {
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
      "@/middleware/old": path.resolve(__dirname, "./middleware/old"),
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

    // Çakışan ts-loader'ları temizle
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
    outputFileTracingRoot: path.join(__dirname, "../../"),
  },

  env: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    COMBINED_JWT_PRIVATE_KEY: process.env.COMBINED_JWT_PRIVATE_KEY,
    COMBINED_JWT_PUBLIC_KEY: process.env.COMBINED_JWT_PUBLIC_KEY,
    COMBINED_JWT_AUD: process.env.COMBINED_JWT_AUD || "clerk-js",
    REDIS_URL: process.env.REDIS_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    NEXT_PUBLIC_CLERK_FRONTEND_API: clerkConfig.domain,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  },
};

module.exports = nextConfig;
