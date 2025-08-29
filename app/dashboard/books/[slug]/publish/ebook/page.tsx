'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@clerk/nextjs';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

type PublishStatus = 'idle' | 'publishing' | 'completed' | 'failed';

interface PublishOptions {
  includeMetadata: boolean;
  includeCover: boolean;
  includeTOC: boolean;
  tocLevel: number;
  includeImprint: boolean;
}

interface BookData {
  id: string;
  title: string;
  epubUrl?: string;
  coverImageUrl?: string;
  author?: string;
  publishStatus?: 'DRAFT' | 'GENERATING' | 'PUBLISHED' | 'FAILED';
  publishError?: string | null;
}

export default function GenerateEbookPage() {
  const { slug } = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  
  // State management
  const [status, setStatus] = useState<PublishStatus>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Publish options
  const [options, setOptions] = useState<PublishOptions>({
    includeMetadata: true,
    includeCover: true,
    includeTOC: true,
    tocLevel: 3,
    includeImprint: true
  });

  // Poll workflow status with retry logic
  const pollWorkflowStatus = async (workflowRunId: string, retryCount = 0): Promise<{status: string; epubUrl?: string; error?: string}> => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 5000; // 5 seconds
    
    try {
      const response = await fetch(`/api/workflows/${workflowRunId}/status`, {
        headers: {
          'Authorization': `Bearer ${await getToken()}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Session expired. Please refresh the page and try again.');
        }
        throw new Error(`Failed to check workflow status: ${response.statusText}`);
      }
      
      return await response.json();
      
    } catch (error) {
      // If we have retries left, wait and try again
      if (retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return pollWorkflowStatus(workflowRunId, retryCount + 1);
      }
      
      // If we're out of retries, rethrow the error
      console.error('Max retries reached while polling workflow status:', error);
      throw error;
    }
  };

  // Start polling with exponential backoff
  const startPolling = (workflowRunId: string, baseInterval = 5000, maxInterval = 30000) => {
    let polling = true;
    let attempt = 0;
    
    const checkStatus = async () => {
      if (!polling) return;
      
      try {
        const { status, epubUrl, error } = await pollWorkflowStatus(workflowRunId);
        
        if (status === 'completed') {
          setStatus('completed');
          setIsLoading(false);
          polling = false;
          
          if (epubUrl) {
            toast.success('EPUB generated successfully!', {
              action: {
                label: 'Download',
                onClick: () => window.open(epubUrl, '_blank')
              }
            });
          }
          return;
        } 
        
        if (status === 'failed') {
          throw new Error(error || 'EPUB generation failed');
        }
        
        // If still in progress, schedule next check with exponential backoff
        if (polling) {
          attempt++;
          const delay = Math.min(baseInterval * Math.pow(1.5, attempt), maxInterval);
          setTimeout(checkStatus, delay);
        }
        
      } catch (error) {
        setStatus('failed');
        setIsLoading(false);
        polling = false;
        
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate EPUB';
        setError(errorMessage);
        
        toast.error('EPUB Generation Failed', {
          description: errorMessage,
          action: {
            label: 'Retry',
            onClick: () => {
              setStatus('idle');
              setError(null);
              handleSubmit(new Event('retry') as unknown as React.FormEvent);
            }
          }
        });
      }
    };
    
    // Start the polling
    checkStatus();
    
    // Return a cleanup function to stop polling
    return () => {
      polling = false;
    };
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsLoading(true);
      setStatus('publishing');
      setError(null);
      
      // Show loading toast
      const toastId = toast.loading('Starting EPUB generation...');
      
      const response = await fetch(`/api/books/by-slug/${slug}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getToken()}`
        },
        body: JSON.stringify({
          format: 'epub',
          options
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start publishing');
      }
      
      const { workflowRunId, workflowUrl } = await response.json();
      
      // Update toast
      toast.loading('Generating EPUB. This may take a few minutes...', {
        id: toastId,
        action: {
          label: 'View Progress',
          onClick: () => window.open(workflowUrl, '_blank')
        }
      });
      
      // Start polling for status
      startPolling(workflowRunId);
      
    } catch (error) {
      console.error('Publish error:', error);
      setStatus('failed');
      setError(error instanceof Error ? error.message : 'Failed to start publishing');
      toast.error('Failed to start publishing', {
        description: error instanceof Error ? error.message : 'An unknown error occurred'
      });
      setIsLoading(false);
    }
  };
  
  // Handle option changes
  const handleOptionChange = (key: keyof PublishOptions, value: any) => {
    setOptions(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Processing your request...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Publish as EPUB</CardTitle>
            <CardDescription>
              Configure the EPUB generation options below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Publishing Options */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="includeMetadata" 
                    checked={options.includeMetadata}
                    onCheckedChange={(checked) => handleOptionChange('includeMetadata', checked)}
                  />
                  <Label htmlFor="includeMetadata">Include Metadata</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="includeCover" 
                    checked={options.includeCover}
                    onCheckedChange={(checked) => handleOptionChange('includeCover', checked)}
                  />
                  <Label htmlFor="includeCover">Include Cover</Label>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="includeTOC" 
                      checked={options.includeTOC}
                      onCheckedChange={(checked) => handleOptionChange('includeTOC', checked)}
                    />
                    <Label htmlFor="includeTOC">Include Table of Contents</Label>
                  </div>
                  
                  {options.includeTOC && (
                    <div className="pl-6 space-y-2">
                      <Label htmlFor="tocLevel">TOC Level: {options.tocLevel}</Label>
                      <Slider
                        id="tocLevel"
                        min={1}
                        max={5}
                        step={1}
                        value={[options.tocLevel]}
                        onValueChange={([value]) => handleOptionChange('tocLevel', value)}
                        className="w-full max-w-md"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="includeImprint" 
                    checked={options.includeImprint}
                    onCheckedChange={(checked) => handleOptionChange('includeImprint', checked)}
                  />
                  <Label htmlFor="includeImprint">Include Imprint Page</Label>
                </div>
              </div>

              {/* Status and Actions */}
              <div className="space-y-4 pt-4">
                {status !== 'idle' && (
                  <div className="flex items-center space-x-2">
                    {status === 'publishing' && (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    )}
                    {status === 'completed' && (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    )}
                    {status === 'failed' && (
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    )}
                    <p className="text-sm font-medium">
                      {status === 'publishing' && 'Generating your EPUB...'}
                      {status === 'completed' && 'Your EPUB is ready!'}
                      {status === 'failed' && 'Failed to generate EPUB'}
                    </p>
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-destructive/10 text-destructive rounded-md text-sm">
                    {error}
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    variant="outline" 
                    type="button"
                    onClick={() => router.push(`/dashboard/books/${slug}`)}
                  >
                    Cancel
                  </Button>
                  
                  <Button 
                    type="submit"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Generate EPUB'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
