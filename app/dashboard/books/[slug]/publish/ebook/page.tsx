'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@clerk/nextjs';
import { Loader2, CheckCircle2, AlertCircle, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

type PublishStatus = 'idle' | 'initializing' | 'ready' | 'publishing' | 'processing' | 'completed' | 'failed';

interface BookData {
  id: string;
  title: string;
  epubUrl?: string;
  coverImageUrl?: string;
  author?: string;
}

// Polling interval in milliseconds
const POLL_INTERVAL = 5000; // 5 seconds

export default function GenerateEbookPage() {
  const { slug } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken, userId } = useAuth();
  
  // State management
  const [status, setStatus] = useState<PublishStatus>('initializing');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [bookData, setBookData] = useState<BookData | null>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Initializing...');
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Initialize component
  useEffect(() => {
    const init = async () => {
      try {
        // Get session ID from URL or create a new one
        const urlSessionId = searchParams.get('sessionId');
        if (urlSessionId) {
          setSessionId(urlSessionId);
          setStatus('ready');
          setMessage('Ready to generate EPUB');
        } else {
          setStatus('initializing');
          setMessage('Initializing new session...');
        }

        // Get auth token
        const token = await getToken();
        if (!token) throw new Error('No session token available');
        setAuthToken(token);

        // Fetch book data
        if (slug) {
          const bookSlug = Array.isArray(slug) ? slug[0] : slug;
          const res = await fetch(`/api/books/by-slug/${bookSlug}`, { 
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (res.ok) {
            const book = await res.json();
            setBookData(book);
            
            // If EPUB already exists, update status
            if (book.epubUrl) {
              setDownloadUrl(book.epubUrl);
              setStatus('completed');
              setMessage('EPUB already generated');
            } else if (status === 'initializing') {
              setStatus('ready');
              setMessage('Ready to generate EPUB');
            }
          }
        }
      } catch (error) {
        console.error('Initialization error:', error);
        setError('Failed to initialize. Please refresh the page.');
        setStatus('failed');
        toast.error('Initialization failed', {
          description: 'Could not load book data. Please try again.'
        });
      }
    };

    init();
  }, [getToken, searchParams, slug]);

  // Handle EPUB generation
  const handleGenerateEPUB = async () => {
    if (!bookData?.id || !authToken) {
      toast.error('Missing required information');
      return;
    }

    try {
      setStatus('publishing');
      setError(null);
      setMessage('Starting EPUB generation...');
      setProgress(0);

      // Create or update session
      const sessionResponse = await fetch('/api/publish/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ 
          bookId: bookData.id,
          format: 'epub'
        })
      });

      if (!sessionResponse.ok) {
        throw new Error('Failed to initialize publishing session');
      }

      const { sessionId: newSessionId } = await sessionResponse.json();
      setSessionId(newSessionId);

      // Trigger EPUB generation
      const response = await fetch('/api/publish/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ 
          sessionId: newSessionId,
          bookId: bookData.id,
          format: 'epub'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start EPUB generation');
      }

      // Start polling for updates
      startPolling(newSessionId);
      
      toast.success('EPUB generation started', {
        description: 'Your EPUB is being generated. This may take a few minutes.'
      });
    } catch (error) {
      console.error('Error generating EPUB:', error);
      setStatus('failed');
      setError(error instanceof Error ? error.message : 'Failed to generate EPUB');
      toast.error('Generation failed', {
        description: 'Could not start EPUB generation. Please try again.'
      });
    }
  };

  // Poll for status updates
  const startPolling = (sessionId: string) => {
    const poll = async () => {
      if (status === 'completed' || status === 'failed') return;

      try {
        const response = await fetch(`/api/publish/status?sessionId=${sessionId}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        if (!response.ok) throw new Error('Failed to fetch status');
        
        const data = await response.json();
        
        // Update status and progress
        if (data.status) setStatus(data.status);
        if (data.progress) setProgress(data.progress);
        if (data.message) setMessage(data.message);
        
        // Handle completion
        if (data.status === 'completed' && data.downloadUrl) {
          setDownloadUrl(data.downloadUrl);
          setStatus('completed');
          setMessage('EPUB generation complete!');
          setProgress(100);
          return;
        }
        
        // Continue polling if still in progress
        if (data.status !== 'completed' && data.status !== 'failed') {
          setTimeout(poll, POLL_INTERVAL);
        }
      } catch (error) {
        console.error('Polling error:', error);
        // Retry after delay
        setTimeout(poll, POLL_INTERVAL);
      }
    };

    poll();
  };

  // Render status UI
  const renderStatus = () => {
    switch (status) {
      case 'initializing':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">{message}</p>
          </div>
        );
      
      case 'ready':
        return (
          <div className="flex flex-col items-center py-8">
            <p className="mb-6 text-center text-muted-foreground">
              Click the button below to generate an EPUB version of your book.
            </p>
            <Button 
              onClick={handleGenerateEPUB}
              disabled={!bookData}
              className="w-48"
            >
              Generate EPUB
            </Button>
          </div>
        );
      
      case 'publishing':
      case 'processing':
        return (
          <div className="flex flex-col items-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">{message}</p>
            <Progress value={progress} className="w-full max-w-md" />
            <p className="text-sm text-muted-foreground">{progress}% complete</p>
          </div>
        );
      
      case 'completed':
        return (
          <div className="flex flex-col items-center py-8 space-y-4">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-medium">EPUB Generated Successfully!</h3>
            <p className="text-muted-foreground text-center">
              Your EPUB file is ready to download.
            </p>
            {downloadUrl && (
              <a
                href={downloadUrl}
                download
                className="mt-4"
              >
                <Button>
                  <Download className="mr-2 h-4 w-4" />
                  Download EPUB
                </Button>
              </a>
            )}
          </div>
        );
      
      case 'failed':
        return (
          <div className="flex flex-col items-center py-8 space-y-4">
            <div className="rounded-full bg-red-100 p-3">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-lg font-medium">Generation Failed</h3>
            <p className="text-muted-foreground text-center">
              {error || 'An unknown error occurred'}
            </p>
            <Button 
              onClick={handleGenerateEPUB}
              variant="outline"
              className="mt-4"
            >
              Try Again
            </Button>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Generate EPUB</CardTitle>
          <CardDescription>
            {bookData ? `Generate an EPUB version of "${bookData.title}"` : 'Loading book details...'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {renderStatus()}
        </CardContent>
      </Card>
    </div>
  );
}
