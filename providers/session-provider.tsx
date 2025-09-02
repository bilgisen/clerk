'use client';

/**
 * This is a no-op provider that's kept for backward compatibility.
 * In Better Auth v0.5+, you can use hooks directly without a provider.
 * 
 * Example usage in components:
 * 
 * import { useSession } from 'better-auth/react';
 * 
 * function MyComponent() {
 *   const { data: session, isLoading } = useSession();
 *   // ...
 * }
 */

export function Providers({ children }: { children: React.ReactNode }) {
  // No provider needed in Better Auth v0.5+
  return <>{children}</>;
}
