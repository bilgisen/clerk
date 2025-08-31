'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

export default function SSOCallbackPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (isAuthenticated) {
      // Redirect to dashboard after successful SSO
      router.push('/dashboard');
    } else {
      // If not authenticated, redirect to sign-in page
      router.push('/sign-in');
    }
  }, [isAuthenticated, loading, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
        <h1 className="text-2xl font-bold">Completing Authentication</h1>
        <p className="text-muted-foreground">
          Please wait while we redirect you...
        </p>
      </div>
    </div>
  );
}
