'use client';

export const dynamic = 'force-dynamic';

import { ReactNode } from 'react';
import Navbar01Page from '@/components/navbar-01/navbar-01';
import { ThemeProvider } from 'next-themes';
import { QueryProvider } from '@/providers/query-provider';
import { ProtectedRoute } from '@/components/auth/protected-route';

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <QueryProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ProtectedRoute>
          <div className="flex min-h-screen flex-col">
            <Navbar01Page />
            <main className="flex-1">{children}</main>
          </div>
        </ProtectedRoute>
      </ThemeProvider>
    </QueryProvider>
  );
}
