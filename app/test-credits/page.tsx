'use client';

import { useState, useEffect } from 'react';
import { useAuth, useUser, SignInButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

export default function TestCreditsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  // Redirect to home if not signed in
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in?redirect_url=' + encodeURIComponent('/test-credits'));
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="container mx-auto p-8 text-center">
        <p>Please sign in to test the credit system.</p>
        <SignInButton mode="modal">
          <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Sign In
          </button>
        </SignInButton>
      </div>
    );
  }

  const testCredits = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const token = await getToken();
      const response = await fetch('/api/test-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to test credits');
      }
      
      setResult(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('Test credits error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Test Credit System</h1>
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <p className="font-medium">Welcome, {user?.fullName || user?.emailAddresses[0]?.emailAddress || 'User'}</p>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-2">Credit System Test</h2>
          <p className="text-gray-600 mb-4">This will test the credit system by adding and spending test credits.</p>
          <button
            onClick={testCredits}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Testing...' : 'Run Tests'}
          </button>
        </div>
        
        {error && (
          <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            <h3 className="font-bold">Error:</h3>
            <pre className="whitespace-pre-wrap">{error}</pre>
          </div>
        )}
        
        {result && (
          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-4">Test Results:</h2>
            <div className="bg-gray-50 p-4 rounded-md overflow-auto max-h-96">
              <pre className="text-sm">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
