'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@clerk/nextjs';

// Polling interval in milliseconds
const POLL_INTERVAL = 10000; // 10 seconds

export default function GenerateEbookPage() {
  const { slug } = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [polling, setPolling] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  
  // Get the auth token when component mounts
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const token = await getToken();
        setAuthToken(token);
      } catch (error) {
        console.error('Error getting auth token:', error);
        toast.error('Authentication error', {
          description: 'Failed to get authentication token. Please try logging in again.'
        });
      }
    };
    
    fetchToken();
  }, [getToken]);
  
  // Function to start polling for completion
  const startPollingForCompletion = (bookId: string) => {
    if (polling) return; // Prevent multiple polling instances
    
    setPolling(true);
    const poll = async () => {
      try {
        const response = await fetch(`/api/books/${bookId}`);
        if (response.ok) {
          const book = await response.json();
          if (book.epubUrl) {
            // EPUB is ready
            toast.success('EPUB generated successfully!', {
              description: (
                <div className="flex flex-col space-y-2">
                  <span>Your EPUB is ready to download.</span>
                  <a 
                    href={book.epubUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    Download EPUB
                  </a>
                </div>
              ),
              duration: 10000, // Keep the toast open longer
            });
            setPolling(false);
            return;
          }
        }
        
        // Continue polling if not found yet
        if (polling) {
          setTimeout(poll, POLL_INTERVAL);
        }
      } catch (error) {
        console.error('Error polling for EPUB:', error);
        setPolling(false);
      }
    };
    
    // Start polling
    setTimeout(poll, POLL_INTERVAL);
    
    // Cleanup function
    return () => {
      setPolling(false);
    };
  };

  const handleGenerateEPUB = async () => {
    if (!slug) {
      console.error('No slug provided');
      toast.error('Error', {
        description: 'No book slug provided. Please try again.'
      });
      return;
    }
    
    if (!authToken) {
      console.error('No authentication token available');
      toast.error('Authentication Required', {
        description: 'Please sign in to generate EPUB.'
      });
      return;
    }
    
    setIsGenerating(true);
    
    try {
      // First, get the book data and payload
      const headers = {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      };
      
      console.log('Fetching book data and payload...');
      const [bookResponse, payloadResponse] = await Promise.all([
        fetch(`/api/books/by-slug/${slug}`, { headers }),
        fetch(`/api/books/by-slug/${slug}/payload`, { headers })
      ]);
      
      if (!bookResponse.ok) {
        const errorText = await bookResponse.text();
        console.error('Failed to fetch book data:', {
          status: bookResponse.status,
          statusText: bookResponse.statusText,
          error: errorText
        });
        throw new Error(`Failed to fetch book data: ${bookResponse.status} ${bookResponse.statusText}`);
      }
      
      if (!payloadResponse.ok) {
        const errorText = await payloadResponse.text();
        console.error('Failed to fetch book payload:', {
          status: payloadResponse.status,
          statusText: payloadResponse.statusText,
          error: errorText
        });
        throw new Error(`Failed to fetch book payload: ${payloadResponse.status} ${payloadResponse.statusText}`);
      }
      
      const book = await bookResponse.json();
      const payload = await payloadResponse.json();
      
      // Trigger GitHub Actions workflow
      const response = await fetch('/api/trigger-workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content_id: book.id,
          format: 'epub',
          metadata: {
            book_id: book.id,
            slug: book.slug,
            title: book.title,
          },
        }),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to start EPUB generation');
      }
      
      const { workflowRunId, workflowUrl } = await response.json();
      
      toast.success('EPUB generation started!', {
        description: (
          <div className="flex flex-col space-y-2">
            <span>Your book is being processed in the background.</span>
            <a 
              href={workflowUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              View workflow progress
            </a>
          </div>
        ),
        duration: 10000, // Keep the toast open longer
      });
      
      // Start polling for completion
      startPollingForCompletion(book.id);
      
    } catch (error) {
      console.error('Error in handleGenerateEPUB:', error);
      
      let errorMessage = 'Failed to start EPUB generation';
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        errorMessage += `: ${error.message}`;
      }
      
      toast.error('EPUB Generation Failed', {
        description: errorMessage,
        duration: 10000
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
