// Type definitions for @better-auth/cli
declare module '@better-auth/cli' {
  import type { betterAuth } from 'better-auth';
  
  /**
   * Configuration for the Better Auth CLI
   */
  interface BetterAuthCLIConfig {
    /**
     * The auth instance to use for the CLI
     */
    auth: ReturnType<typeof betterAuth>;
  }
  
  /**
   * Define the configuration for the Better Auth CLI
   */
  export function defineConfig(config: BetterAuthCLIConfig): BetterAuthCLIConfig;
}
