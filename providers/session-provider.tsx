'use client';

export function Providers({ children }: { children: React.ReactNode }) {
  // Better-auth handles session management internally
  return <>{children}</>;
}
