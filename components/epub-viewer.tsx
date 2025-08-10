'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

// Define the props interface
interface EpubViewerProps {
  url: string;
  style?: React.CSSProperties;
}

// Dynamically import the epubjs library with no SSR
const Epub = dynamic(
  () => import('epubjs').then((mod) => mod.default || mod),
  { ssr: false }
);

export function EpubViewer({ url, style = {} }: EpubViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [book, setBook] = useState<any>(null);
  const [rendition, setRendition] = useState<any>(null);
  const [location, setLocation] = useState<string>('');
  const [toc, setToc] = useState<any[]>([]);

  // Initialize the EPUB viewer
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    setIsClient(true);
    
    if (!url) {
      setIsLoading(false);
      return;
    }

    let currentBook: any;
    let currentRendition: any;

    const initBook = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Initialize the book
        currentBook = Epub(url);
        setBook(currentBook);

        // Load the book metadata and TOC
        await currentBook.ready;
        const toc = await currentBook.navigation;
        setToc(toc);

        // Initialize the rendition
        if (viewerRef.current) {
          currentRendition = currentBook.renderTo(viewerRef.current, {
            width: '100%',
            height: '100%',
            spread: 'none',
          });
          
          await currentRendition.display();
          setRendition(currentRendition);
          
          // Set up location change handler
          currentRendition.on('relocated', (loc: any) => {
            setLocation(loc?.start?.cfi || '');
          });
        }
      } catch (err) {
        console.error('Error loading EPUB:', err);
        setError('Failed to load the EPUB file');
      } finally {
        setIsLoading(false);
      }
    };

    initBook();

    // Cleanup function
    return () => {
      if (currentRendition) {
        currentRendition.destroy();
      }
      if (currentBook) {
        currentBook.destroy();
      }
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    };
  }, [url]);

  // Navigation handlers
  const nextPage = () => {
    if (rendition) {
      rendition.next();
    }
  };

  const prevPage = () => {
    if (rendition) {
      rendition.prev();
    }
  };

  if (!isClient) {
    return (
      <div className="flex items-center justify-center h-full" style={style}>
        <p>Initializing EPUB viewer...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" style={style}>
        <p>Loading EPUB file...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full" style={style}>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex items-center justify-center h-full" style={style}>
        <p className="text-muted-foreground">No EPUB file available for preview</p>
      </div>
    );
  }

  return (
    <div 
      className="relative w-full h-full flex flex-col"
      style={{
        minHeight: '600px',
        ...style
      }}
    >
      {/* Navigation controls */}
      <div className="flex justify-between p-2 bg-gray-100 dark:bg-gray-800">
        <button 
          onClick={prevPage}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          disabled={!rendition}
        >
          Previous
        </button>
        <div className="text-sm text-gray-600 dark:text-gray-300">
          {location ? `Location: ${location.substring(0, 30)}...` : 'Ready'}
        </div>
        <button 
          onClick={nextPage}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          disabled={!rendition}
        >
          Next
        </button>
      </div>
      
      {/* EPUB container */}
      <div 
        ref={viewerRef}
        className="flex-1 overflow-hidden"
        style={{
          width: '100%',
          height: '100%',
          minHeight: '500px',
        }}
      />
    </div>
  );
}
