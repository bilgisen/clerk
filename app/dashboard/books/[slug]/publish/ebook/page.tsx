'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function GenerateEbookPage() {
  const { slug } = useParams();
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateEPUB = async () => {
    if (!slug) return;
    
    setIsGenerating(true);
    
    try {
      const response = await fetch(`/api/books/by-slug/${slug}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start EPUB generation');
      }
      
      toast.success('EPUB generation started successfully!', {
        description: 'Your book is being processed. You will be notified when it\'s ready.',
      });
      
      // Optionally, you could redirect to a status page or update the UI
      // router.push(`/dashboard/books/${slug}/publish/status`);
      
    } catch (error) {
      console.error('Error generating EPUB:', error);
      toast.error('Failed to start EPUB generation', {
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold mb-6">Generate EPUB</h1>
          
          <div className="space-y-6">
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
              <h2 className="text-lg font-medium mb-2">EPUB Generation</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Click the button below to generate an EPUB version of your book. This may take a few minutes.
              </p>
              
              <Button
                onClick={handleGenerateEPUB}
                disabled={isGenerating}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </>
                ) : (
                  'Generate EPUB'
                )}
              </Button>
              
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                You'll be able to download the EPUB file once generation is complete.
              </p>
            </div>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    EPUB generation may take a few minutes. You can continue working while we process your book.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}