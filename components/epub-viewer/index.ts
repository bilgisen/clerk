// Import the main component
import EpubViewer from './epub-viewer';

// Re-export the main EpubViewer component and its types
export { EpubViewer };
export type { EpubViewerProps } from './epub-viewer';

// Re-export the inner component and its types
export { EpubViewerInner } from './epub-viewer-inner';
export type { EpubViewerInnerProps } from './epub-viewer-inner';

export default EpubViewer;
