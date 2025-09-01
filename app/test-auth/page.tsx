'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';

export default function TestAuthPage() {
  const { user, isLoading, signIn, signOut } = useAuth();
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testAuth = async () => {
    try {
      setError(null);
      const response = await fetch('/api/test-auth');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to authenticate');
      }
      
      setApiResponse(data);
    } catch (err) {
      console.error('Test auth error:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Test Authentication
          </h2>
        </div>
        
        {!user ? (
          <div className="mt-8 space-y-6">
            <button
              onClick={() => signIn('google')}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Sign in with Google
            </button>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <div className="bg-gray-50 p-4 rounded-md">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Logged in as:</span> {user.email}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <span className="font-medium">Role:</span> {user.role || 'user'}
              </p>
            </div>
            
            <button
              onClick={testAuth}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Test Protected API
            </button>
            
            <button
              onClick={signOut}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Sign Out
            </button>
            
            {apiResponse && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
                <h3 className="text-sm font-medium text-green-800">API Response:</h3>
                <pre className="mt-1 text-sm text-green-700 overflow-x-auto">
                  {JSON.stringify(apiResponse, null, 2)}
                </pre>
              </div>
            )}
            
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                <h3 className="text-sm font-medium text-red-800">Error:</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
