'use client';

import { ClerkProvider as ClerkProviderBase } from "@clerk/nextjs";
import type { Appearance } from "@clerk/types";
import { ErrorBoundary } from "@/components/error-boundary";
import { logError } from "@/lib/utils/error-handler";

export function ClerkProvider({
  children,
  appearance,
  nonce,
}: {
  children: React.ReactNode;
  appearance: Appearance;
  nonce: string;
}) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('ClerkProvider Error Boundary caught:', {
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          componentStack: errorInfo?.componentStack,
          clerkConfig: {
            hasAppearance: !!appearance,
            publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? '***' : 'MISSING',
            domain: process.env.NEXT_PUBLIC_CLERK_DOMAIN || 'default',
          }
        });
        logError(error, { 
          componentName: 'ClerkProvider',
          errorInfo: {
            componentStack: errorInfo?.componentStack,
            clerkConfig: {
              hasAppearance: !!appearance,
              hasPublishableKey: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
              domain: process.env.NEXT_PUBLIC_CLERK_DOMAIN || 'default',
            }
          }
        });
      }}
      fallback={
        <div className="p-4 bg-red-50 border border-red-200 rounded m-4">
          <h1 className="text-xl font-bold text-red-600 mb-2">Authentication Service Unavailable</h1>
          <p className="mb-2">We're having trouble connecting to our authentication service.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      }
    >
      <ClerkProviderBase 
        appearance={appearance}
        nonce={nonce}
        publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      >
        {children}
      </ClerkProviderBase>
    </ErrorBoundary>
  );
}
