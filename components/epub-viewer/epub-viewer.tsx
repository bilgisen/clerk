'use client';

import dynamic from 'next/dynamic';

// Define the props interface
interface EpubViewerProps {
  url: string;
  style?: React.CSSProperties;
}

// Export the props type for external use
export type { EpubViewerProps };

// Dynamically import the inner component with no SSR
const EpubViewerInner = dynamic<EpubViewerProps>(
  () => import('./epub-viewer-inner').then(mod => mod.EpubViewerInner),
  { 
    ssr: false,
    loading: () => (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
        color: '#666',
        fontSize: '1rem',
        fontFamily: 'sans-serif'
      }}>
        Loading EPUB viewer...
      </div>
    )
  }
);

/**
 * EPUB Viewer Component
 * 
 * A React component that renders an EPUB file with navigation controls.
 * 
 * @component
 * @example
 * ```tsx
 * <EpubViewer url="/path/to/book.epub" />
 * ```
 */
const EpubViewer = (props: EpubViewerProps) => {
  return <EpubViewerInner {...props} />;
};

export { EpubViewer };
export default EpubViewer;
