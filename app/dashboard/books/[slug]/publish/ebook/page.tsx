'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@clerk/nextjs';
import { BooksMenu } from '@/components/books/books-menu';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const [generateToc, setGenerateToc] = useState<boolean>(true);
  const [includeImprint, setIncludeImprint] = useState<boolean>(true);
  const [includeCover, setIncludeCover] = useState<boolean>(true);
  const [style, setStyle] = useState<'default' | 'style2'>('default');
  const [tocDepth, setTocDepth] = useState<number>(3);

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

  // On mount, fetch book by slug to prefill status if EPUB already exists
  useEffect(() => {
    const init = async () => {
      try {
        if (!slug) return;
        const res = await fetch(`/api/books/by-slug/${slug}`, { cache: 'no-store', credentials: 'include' });
        if (!res.ok) return;
        const book = await res.json();
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
  
  // Function to start polling for completion
  const startPollingForCompletion = (bookId: string) => {
    if (polling) return; // Prevent multiple polling instances
    
    setPolling(true);
    const poll = async () => {
      try {
        // Poll the secure by-id endpoint for the latest book state
        const response = await fetch(`/api/books/by-id/${bookId}`, { cache: 'no-store' });
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
        },
        body: JSON.stringify({
          content_id: book.id,
          format,
          metadata: {
            book_id: book.id,
            slug: book.slug,
            title: book.title,
            options: { format, generateToc, includeImprint, includeCover, style, tocDepth }
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

  return (
    <div className="container mx-auto px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Publish E-Book</h1>
            <p className="text-muted-foreground">Publish ebook version of {slug}</p>
          </div>
          <BooksMenu slug={slug as string} />
        </div>
        <Separator className="my-4" />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Publishing Options (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Publishing Options</CardTitle>
              <CardDescription>Customize how your ebook will be generated</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Format Selection */}
              <div className="space-y-2">
                <Label>Format</Label>
                <RadioGroup 
                  value={format} 
                  onValueChange={(value) => setFormat(value as 'epub' | 'mobi')}
                  className="grid grid-cols-2 gap-4 pt-2"
                >
                  <div>
                    <RadioGroupItem value="epub" id="epub" className="peer sr-only" />
                    <Label
                      htmlFor="epub"
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                    >
                      <div className="font-medium">EPUB</div>
                      <div className="text-xs text-muted-foreground">Standard format</div>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="mobi" id="mobi" className="peer sr-only" />
                    <Label
                      htmlFor="mobi"
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                    >
                      <div className="font-medium">MOBI</div>
                      <div className="text-xs text-muted-foreground">Kindle format</div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Checkbox Options */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="generateToc" 
                    checked={generateToc} 
                    onCheckedChange={(checked) => setGenerateToc(checked as boolean)} 
                  />
                  <Label htmlFor="generateToc" className="font-normal">
                    Generate Table of Contents
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="includeImprint" 
                    checked={includeImprint} 
                    onCheckedChange={(checked) => setIncludeImprint(checked as boolean)} 
                  />
                  <Label htmlFor="includeImprint" className="font-normal">
                    Include Imprint Page
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="includeCover" 
                    checked={includeCover} 
                    onCheckedChange={(checked) => setIncludeCover(checked as boolean)} 
                  />
                  <Label htmlFor="includeCover" className="font-normal">
                    Include Book Cover
                  </Label>
                </div>
              </div>

              {/* Advanced Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="style">Style</Label>
                  <Select value={style} onValueChange={(value) => setStyle(value as 'default' | 'style2')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="style2">Style 2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tocDepth">TOC Depth</Label>
                  <Input 
                    id="tocDepth"
                    type="number" 
                    min={1} 
                    max={6} 
                    value={tocDepth} 
                    onChange={(e) => setTocDepth(parseInt(e.target.value || '3', 10))} 
                  />
                </div>

              </div>
            </CardContent>
            <CardFooter className="flex justify-end border-t px-6 py-4">
              <Button 
                onClick={handleGenerateEPUB} 
                disabled={isGenerating}
                className="w-full sm:w-auto"
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
                  'Generate E-Book'
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Right Column - Generation Progress (1/3 width) */}
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
                disabled={!downloadUrl}
              >
                <a 
                  href={downloadUrl || '#'} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  onClick={(e) => !downloadUrl && e.preventDefault()}
                >
                  {status === 'completed' ? 'Download E-Book' : 
                   status === 'processing' ? 'Generating...' : 
                   'E-Book Not Ready'}
                </a>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
