'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@clerk/nextjs';
import { BooksMenu } from '@/components/books/books-menu';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { BookInfo } from '@/components/books/book-info';
import { Progress } from '@/components/ui/progress';

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
  const [style, setStyle] = useState<'default' | 'style2'>('default');
  const [includeMetadata, setIncludeMetadata] = useState<boolean>(true);
  const [generateToc, setGenerateToc] = useState<boolean>(true);
  const [tocDepth, setTocDepth] = useState<number>(3);
  const [includeImprint, setIncludeImprint] = useState<boolean>(true);
  const [includeCover, setIncludeCover] = useState<boolean>(true);
  const [bookData, setBookData] = useState<any>(null);

  // Simple progress state
  const [status, setStatus] = useState<'idle' | 'starting' | 'triggered' | 'processing' | 'completed' | 'failed'>('idle');
  
  // State for file handling
  const [epubFile, setEpubFile] = useState<File | null>(null);

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

  // On mount, fetch book by slug to prefill status if EPUB already exists
  useEffect(() => {
    const init = async () => {
      try {
        if (!slug) return;
        const res = await fetch(`/api/books/by-slug/${slug}`, { cache: 'no-store', credentials: 'include' });
        if (!res.ok) return;
        const book = await res.json();
        setBookData(book);
        setBookId(book.id);
        if (book?.epubUrl) {
          setDownloadUrl(book.epubUrl);
          setStatus('completed');
        }
      } catch (e) {
        console.warn('Init load book failed', e);
      }
    };
    init();
  }, [slug]);
  
  // Function to start polling for completion with retry logic
  const startPollingForCompletion = (bookId: string, attempt = 1) => {
    if (polling) return; // Prevent multiple polling instances
    
    setPolling(true);
    const poll = async (currentAttempt: number) => {
      try {
        // Add a cache-busting parameter to the URL
        const cacheBuster = `_t=${Date.now()}`;
        const response = await fetch(`/api/books/by-id/${bookId}?${cacheBuster}`, { 
          cache: 'no-store',
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        
        if (response.ok) {
          const book = await response.json();
          console.log('Polling response:', { book });
          
          if (book.epubUrl) {
            // Add cache-buster to the download URL
            const downloadUrl = `${book.epubUrl}${book.epubUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
            setDownloadUrl(downloadUrl);
            setStatus('completed');
            
            // Download the file for preview
            try {
              const epubResponse = await fetch(downloadUrl);
              const epubBlob = await epubResponse.blob();
              const epubFile = new File([epubBlob], `book-${bookId}.epub`, { type: 'application/epub+zip' });
              setEpubFile(epubFile);
            } catch (e) {
              console.warn('Failed to prepare EPUB for preview:', e);
            }
            
            toast.success('EPUB generated successfully!', {
              description: 'Your EPUB is ready to download and preview.',
              duration: 10000,
            });
            setPolling(false);
            return;
          } else if (currentAttempt < 30) { // Try for max 5 minutes (30 attempts * 10 seconds)
            // Continue polling
            setTimeout(() => poll(currentAttempt + 1), POLL_INTERVAL);
          } else {
            // Timeout after 5 minutes
            setStatus('failed');
            setPolling(false);
            toast.error('EPUB generation timed out', {
              description: 'The EPUB generation is taking longer than expected. Please try again later.',
            });
          }
        } else {
          console.error('Error polling for book:', await response.text());
          // Continue polling on error (server might be temporarily unavailable)
          if (currentAttempt < 30) {
            setTimeout(() => poll(currentAttempt + 1), POLL_INTERVAL);
          } else {
            setStatus('failed');
            setPolling(false);
            toast.error('Error checking EPUB status', {
              description: 'Failed to check if EPUB is ready. Please refresh the page and try again.',
            });
          }
        }
      } catch (error) {
        console.error('Error polling for EPUB:', error);
        if (currentAttempt < 30) {
          setTimeout(() => poll(currentAttempt + 1), POLL_INTERVAL);
        } else {
          setStatus('failed');
          setPolling(false);
          toast.error('Error checking EPUB status', {
            description: 'Failed to check if EPUB is ready. Please refresh the page and try again.',
          });
        }
      }
    };
    
    // Start polling
    poll(attempt);
    
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

      // If EPUB already exists, mark as completed immediately
      if (book.epubUrl) {
        setStatus('completed');
      }

      // 2) Prepare payload options (query params)
      const params = new URLSearchParams({
        format,
        generate_toc: String(generateToc),
        include_imprint: String(includeImprint),
        cover: String(includeCover),
        style,
        toc_depth: String(tocDepth)
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
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          content_id: book.id,
          metadata: {
            format,
            book_id: book.id,
            slug: book.slug,
            title: book.title,
            generateToc,
            includeImprint,
            includeCover,
            style,
            tocDepth
          }
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

  // Calculate progress percentage based on status
  const getProgress = () => {
    switch(status) {
      case 'starting': return 25;
      case 'triggered': return 50;
      case 'processing': return 75;
      case 'completed': return 100;
      case 'failed': return 0;
      default: return 0;
    }
  };

  if (!bookData) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Generate Ebook</h1>
        {bookId && (
          <BooksMenu 
            slug={typeof slug === 'string' ? slug : ''} 
            bookId={bookId}
          />
        )}
      </div>
      
      <Separator />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Book Info */}
        <div className="space-y-6">
          <BookInfo 
            book={{
              id: bookData.id,
              title: bookData.title,
              author: bookData.author,
              coverImageUrl: bookData.coverImageUrl
            }} 
            className="w-full"
          />
        </div>
        
        {/* Middle Column - Publishing Options */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Publishing Options</CardTitle>
              <CardDescription>Customize your ebook settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="include-metadata" 
                    checked={includeMetadata} 
                    onCheckedChange={(checked) => setIncludeMetadata(checked === true)}
                  />
                  <Label htmlFor="include-metadata">Include Metadata</Label>
                </div>
                
                <div className="space-y-2 pl-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="include-cover" 
                      checked={includeCover} 
                      onCheckedChange={(checked) => setIncludeCover(checked === true)}
                      disabled={!includeMetadata}
                    />
                    <Label htmlFor="include-cover">Include Cover</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="include-imprint" 
                      checked={includeImprint} 
                      onCheckedChange={(checked) => setIncludeImprint(checked === true)}
                      disabled={!includeMetadata}
                    />
                    <Label htmlFor="include-imprint">Include Imprint</Label>
                  </div>
                </div>
              </div>
              
              <Separator className="my-4" />
              
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="generate-toc" 
                    checked={generateToc} 
                    onCheckedChange={(checked) => setGenerateToc(checked === true)}
                  />
                  <Label htmlFor="generate-toc">Generate Table of Contents</Label>
                </div>
                
                {generateToc && (
                  <div className="pl-6 space-y-2">
                    <div className="flex justify-between">
                      <Label htmlFor="toc-depth">TOC Depth: {tocDepth}</Label>
                    </div>
                    <Slider
                      id="toc-depth"
                      min={1}
                      max={5}
                      step={1}
                      value={[tocDepth]}
                      onValueChange={(value) => setTocDepth(value[0])}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleGenerateEPUB}
                disabled={isGenerating || status === 'processing'}
                className="w-full"
              >
                {isGenerating || status === 'processing' ? 'Generating...' : 'Generate EPUB'}
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        {/* Right Column - Generation Progress */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Generation Progress</CardTitle>
              <CardDescription>Track the status of your ebook generation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Status</span>
                  <span className="font-medium capitalize">
                    {status === 'idle' ? 'Ready' : status}
                    {status === 'completed' && ' 🎉'}
                    {status === 'failed' && ' ❌'}
                  </span>
                </div>
                <Progress value={getProgress()} className="h-2" />
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Generation Steps</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${
                        status !== 'idle' ? 'bg-primary' : 'bg-muted-foreground/20'
                      }`}></div>
                      <span className={status !== 'idle' ? 'font-medium' : 'text-muted-foreground'}>Initializing</span>
                    </div>
                    {status !== 'idle' && <span className="text-xs text-muted-foreground">✓</span>}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${
                        ['triggered', 'processing', 'completed'].includes(status) ? 'bg-primary' : 'bg-muted-foreground/20'
                      }`}></div>
                      <span className={['triggered', 'processing', 'completed'].includes(status) ? 'font-medium' : 'text-muted-foreground'}>
                        Preparing Content
                      </span>
                    </div>
                    {['triggered', 'processing', 'completed'].includes(status) && <span className="text-xs text-muted-foreground">✓</span>}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${
                        ['processing', 'completed'].includes(status) ? 'bg-primary' : 'bg-muted-foreground/20'
                      }`}></div>
                      <span className={['processing', 'completed'].includes(status) ? 'font-medium' : 'text-muted-foreground'}>
                        Generating E-Book
                      </span>
                    </div>
                    {['processing', 'completed'].includes(status) && <span className="text-xs text-muted-foreground">
                      {status === 'processing' ? '...' : '✓'}
                    </span>}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${
                        status === 'completed' ? 'bg-green-500' : 
                        status === 'failed' ? 'bg-destructive' : 'bg-muted-foreground/20'
                      }`}></div>
                      <span className={status === 'completed' || status === 'failed' ? 'font-medium' : 'text-muted-foreground'}>
                        {status === 'failed' ? 'Failed' : 'Completed'}
                      </span>
                    </div>
                    {(status === 'completed' || status === 'failed') && (
                      <span className="text-xs text-muted-foreground">
                        {status === 'completed' ? '✓' : '✗'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
              <Button 
                asChild 
                className="w-full"
                disabled={!downloadUrl || status !== 'completed'}
              >
                <a 
                  href={downloadUrl || '#'} 
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (!downloadUrl || status !== 'completed') {
                      e.preventDefault();
                      // Show a helpful message if the user clicks when not ready
                      if (status === 'processing') {
                        toast.info('Your E-Book is still being generated. Please wait...');
                      } else if (!downloadUrl) {
                        toast.warning('No E-Book URL available. Please generate the E-Book first.');
                      }
                    }
                  }}
                  className="flex items-center justify-center gap-2"
                >
                  {status === 'completed' && downloadUrl ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      Download E-Book
                    </>
                  ) : status === 'processing' ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </>
                  ) : (
                    'E-Book Not Ready'
                  )}
                </a>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

