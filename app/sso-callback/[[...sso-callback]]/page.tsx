'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';

export default function SSOCallbackPage() {
  const router = useRouter();
  const { isLoaded, userId } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    
    // If user is authenticated, redirect to dashboard
    if (userId) {
      router.push('/dashboard');
    } else {
      // If not authenticated, redirect to sign-in after a short delay
      const timer = setTimeout(() => {
        router.push('/sign-in');
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isLoaded, userId, router]);

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
