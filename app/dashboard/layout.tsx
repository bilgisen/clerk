export const dynamic = 'force-dynamic';

import { ReactNode } from 'react';
import Navbar01Page from '@/components/navbar-01/navbar-01';
import { ThemeProvider } from 'next-themes';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { QueryProvider } from '@/providers/query-provider';

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Authentication is now handled by the middleware
  return (
    <QueryProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <div className="flex min-h-screen flex-col">
          <Navbar01Page />
          <main className="flex-1">{children}</main>
        </div>
      </ThemeProvider>
    </QueryProvider>
  );
}
