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
  const [bookId, setBookId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Publishing options state
  const [format, setFormat] = useState<'epub' | 'mobi'>('epub');
  const [generateToc, setGenerateToc] = useState<boolean>(true);
  const [includeImprint, setIncludeImprint] = useState<boolean>(true);
  const [includeCover, setIncludeCover] = useState<boolean>(true);
  const [style, setStyle] = useState<'default' | 'style2'>('default');
  const [tocDepth, setTocDepth] = useState<number>(3);
  const [language, setLanguage] = useState<string>('tr');

  // Simple progress state
  const [status, setStatus] = useState<'idle' | 'starting' | 'triggered' | 'processing' | 'completed' | 'failed'>('idle');
  
  // Get the auth token when component mounts
  useEffect(() => {
    const fetchToken = async () => {
      try {
        console.log('Fetching session token...');
        const token = await getToken();
        console.log('Got token:', token ? '[TOKEN_RECEIVED]' : 'No token received');
        
        if (!token) {
          throw new Error('No session token available');
        }
        
        setAuthToken(token);
        console.log('Auth token set in state');
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
            setDownloadUrl(book.epubUrl);
            setStatus('completed');
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
        setStatus('failed');
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
    setStatus('starting');
    
    try {
      // Prepare headers for the request
      const headers = new Headers({
        'Content-Type': 'application/json',
      });
      
      // Add the auth token if available
      if (authToken) {
        headers.append('Authorization', `Bearer ${authToken}`);
      }
      
      // 1) Fetch book (need id for by-id payload)
      const bookRes = await fetch(`/api/books/by-slug/${slug}`, { 
        headers,
        credentials: 'include',
        cache: 'no-store'
      });
      if (!bookRes.ok) {
        const errTxt = await bookRes.text().catch(() => '');
        throw new Error(`Failed to fetch book: ${bookRes.status} ${errTxt}`);
      }
      const book = await bookRes.json();
      setBookId(book.id);
      setDownloadUrl(book.epubUrl || null);

      // 2) Prepare payload options (query params)
      const params = new URLSearchParams({
        format,
        generate_toc: String(generateToc),
        include_imprint: String(includeImprint),
        cover: String(includeCover),
        style,
        toc_depth: String(tocDepth),
        language
      });

      // 3) Precompute payload (optional: ensures route works with options)
      const payloadUrl = `/api/books/by-id/${book.id}/payload?` + params.toString();
      const payloadRes = await fetch(payloadUrl, { headers, cache: 'no-store' });
      if (!payloadRes.ok) {
        const errTxt = await payloadRes.text().catch(() => '');
        throw new Error(`Failed to prepare payload: ${payloadRes.status} ${errTxt}`);
      }

      // 4) Trigger GitHub Actions workflow (server will pick up options via payload)
      setStatus('triggered');
      const response = await fetch('/api/trigger-workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content_id: book.id,
          format,
          metadata: {
            book_id: book.id,
            slug: book.slug,
            title: book.title,
            options: { format, generateToc, includeImprint, includeCover, style, tocDepth, language }
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
      
      setStatus('processing');
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
      setStatus('failed');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold mb-6">Publish E‑Book</h1>
          
          <div className="space-y-6">
            {/* Publishing Options */}
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md space-y-4">
              <h2 className="text-lg font-medium">Publishing Options</h2>

              {/* Format */}
              <div>
                <label className="block text-sm font-medium mb-1">Format</label>
                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" name="format" value="epub" checked={format === 'epub'} onChange={() => setFormat('epub')} className="h-4 w-4" />
                    <span>EPUB</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" name="format" value="mobi" checked={format === 'mobi'} onChange={() => setFormat('mobi')} className="h-4 w-4" />
                    <span>MOBI</span>
                  </label>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={generateToc} onChange={(e) => setGenerateToc(e.target.checked)} className="h-4 w-4" />
                  <span>Add TOC</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={includeImprint} onChange={(e) => setIncludeImprint(e.target.checked)} className="h-4 w-4" />
                  <span>Add Imprint</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={includeCover} onChange={(e) => setIncludeCover(e.target.checked)} className="h-4 w-4" />
                  <span>Include Cover</span>
                </label>
              </div>

              {/* Style and TOC depth */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Style</label>
                  <select value={style} onChange={(e) => setStyle(e.target.value as 'default' | 'style2')} className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2">
                    <option value="default">Default</option>
                    <option value="style2">Style 2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">TOC Depth</label>
                  <input type="number" min={1} max={6} value={tocDepth} onChange={(e) => setTocDepth(parseInt(e.target.value || '3', 10))} className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2" />
                </div>
              </div>

              {/* Language */}
              <div>
                <label className="block text-sm font-medium mb-1">Language</label>
                <input type="text" value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2" />
              </div>
            </div>

            {/* Actions */}
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
              <h2 className="text-lg font-medium mb-2">Generate</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">Generate your e‑book with the selected options.</p>
              <div className="flex items-center gap-3">
                <Button onClick={handleGenerateEPUB} disabled={isGenerating} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {isGenerating ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    'Generate E‑Book'
                  )}
                </Button>
                <Button asChild variant="outline" disabled={!downloadUrl}>
                  <a href={downloadUrl || '#'} target="_blank" rel="noopener noreferrer">Download</a>
                </Button>
              </div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">You will be able to download once generation completes.</p>
            </div>

            {/* Progress Steps */}
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
              <h3 className="text-sm font-medium mb-3">Progress</h3>
              <ol className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${status !== 'idle' ? 'bg-blue-500' : 'bg-gray-400'}`}></span>
                  Start
                </li>
                <li className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${status === 'triggered' || status === 'processing' || status === 'completed' ? 'bg-blue-500' : 'bg-gray-400'}`}></span>
                  Triggered
                </li>
                <li className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${status === 'processing' || status === 'completed' ? 'bg-blue-500' : 'bg-gray-400'}`}></span>
                  Processing
                </li>
                <li className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${status === 'completed' ? 'bg-green-500' : status === 'failed' ? 'bg-red-500' : 'bg-gray-400'}`}></span>
                  Completed
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
