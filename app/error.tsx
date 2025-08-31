'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Error boundary caught:', error);
    
    // You can log to your error tracking service here
    // Example: logErrorToService(error, { path: window.location.pathname });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Something went wrong</h1>
          <p className="text-gray-500 dark:text-gray-400">
            We're sorry, but an unexpected error occurred. Our team has been notified.
          </p>
          {error.digest && (
            <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded text-left">
              <p className="text-sm font-mono text-gray-500 dark:text-gray-400">
                Error ID: {error.digest}
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            variant="outline"
            onClick={() => reset()}
            className="w-full sm:w-auto"
          >
            Try Again
          </Button>
          <Button asChild variant="ghost" className="w-full sm:w-auto">
            <Link href="/">Go to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
