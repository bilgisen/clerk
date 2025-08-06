'use client';

import { useEffect, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { RdtChapterTree } from './rst-chapter-tree';
import { ChapterNode } from '@/lib/services/chapter-tree';

export interface ChapterTreeWrapperProps {
  chapters: ChapterNode[];
  onSave: (chapters: ChapterNode[]) => Promise<ChapterNode[] | void>;
  onSaveSuccess?: () => void;
  onEdit?: (id: string) => void;
  onView?: (id: string) => void;
  onDelete?: (id: string) => void | Promise<void>;
  className?: string;
  isSaving?: boolean;
}

export function ChapterTreeWrapper(props: ChapterTreeWrapperProps) {
  const [isMounted, setIsMounted] = useState(false);

  // This is a workaround for Next.js SSR - wait for component to mount on client
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Don't render DnD context during SSR
  if (!isMounted) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <RdtChapterTree {...props} />
    </DndProvider>
  );
}
