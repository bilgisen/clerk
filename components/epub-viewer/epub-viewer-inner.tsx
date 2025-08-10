'use client';

import { useEffect, useRef, useState } from 'react';
import type { Book, Rendition } from 'epubjs';
import type { NavItem } from 'epubjs/types/navigation';

// Export the props type for external use
export interface EpubViewerInnerProps {
  url: string;
  style?: React.CSSProperties;
}

function EpubViewerInner({ url, style = {} }: EpubViewerInnerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const [location, setLocation] = useState<string>('');
  const [toc, setToc] = useState<NavItem[]>([]);

  // Initialize the EPUB viewer
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    setIsClient(true);
    
    if (!url) {
      setIsLoading(false);
      return;
    }

    let currentBook: Book | null = null;
    let currentRendition: Rendition | null = null;

    const initBook = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Dynamically import epubjs to avoid SSR issues
        const { default: ePub } = await import('epubjs');
        
        // Initialize the book
        currentBook = ePub(url);
        setBook(currentBook);

        // Load the book metadata and TOC
        await currentBook.ready;
        const navigation = await currentBook.loaded.navigation;
        setToc(navigation?.toc || []);

        // Initialize the rendition
        if (viewerRef.current) {
          currentRendition = currentBook.renderTo(viewerRef.current, {
            width: '100%',
            height: '100%',
            spread: 'none',
            allowScriptedContent: false,
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
    rendition?.next();
  };

  const prevPage = () => {
    rendition?.prev();
  };

  const goToChapter = (href: string) => {
    rendition?.display(href);
  };

  if (!isClient) {
    return <div>Initializing EPUB viewer...</div>;
  }

  if (error) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'red',
        ...style
      }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      ...style
    }}>
      {/* Toolbar */}
      <div style={{
        padding: '0.5rem',
        backgroundColor: '#f5f5f5',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        gap: '0.5rem',
        flexWrap: 'wrap'
      }}>
        <button 
          onClick={prevPage}
          disabled={!rendition}
          style={{
            padding: '0.25rem 0.5rem',
            backgroundColor: '#fff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: rendition ? 'pointer' : 'not-allowed',
            opacity: rendition ? 1 : 0.5
          }}
        >
          Previous
        </button>
        <button 
          onClick={nextPage}
          disabled={!rendition}
          style={{
            padding: '0.25rem 0.5rem',
            backgroundColor: '#fff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: rendition ? 'pointer' : 'not-allowed',
            opacity: rendition ? 1 : 0.5
          }}
        >
          Next
        </button>
      </div>
      
      {/* Main content */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Table of Contents */}
        {toc.length > 0 && (
          <div style={{
            width: '250px',
            borderRight: '1px solid #e0e0e0',
            overflowY: 'auto',
            padding: '1rem',
            backgroundColor: '#fafafa'
          }}>
            <h3 style={{
              marginTop: 0,
              marginBottom: '1rem',
              paddingBottom: '0.5rem',
              borderBottom: '1px solid #e0e0e0'
            }}>
              Table of Contents
            </h3>
            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: 0
            }}>
              {toc.map((item) => (
                <li 
                  key={item.id}
                  style={{
                    padding: '0.25rem 0',
                    cursor: 'pointer',
                    color: '#1976d2',
                    textDecoration: 'none',
                    transition: 'text-decoration 0.2s ease-in-out'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                  onClick={() => goToChapter(item.href)}
                >
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* EPUB container */}
        <div 
          ref={viewerRef}
          style={{
            flex: 1,
            overflow: 'auto',
            position: 'relative',
            backgroundColor: '#fff'
          }}
        />
        
        {/* Loading overlay */}
        {isLoading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: toc.length > 0 ? '250px' : 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            zIndex: 10
          }}>
            <div style={{
              padding: '1rem 2rem',
              backgroundColor: 'white',
              borderRadius: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              Loading EPUB content...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { EpubViewerInner };
