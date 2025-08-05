'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ChapterNode } from '@/types/dnd';

interface SimpleChapterListProps {
  chapters: ChapterNode[];
  className?: string;
}

export function SimpleChapterList({ chapters, className = '' }: SimpleChapterListProps) {
  if (chapters.length === 0) {
    return (
      <div className="py-4 text-center text-muted-foreground">
        No chapters found.
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {chapters.map((chapter) => (
        <div
          key={chapter.id}
          className="flex items-center justify-between rounded-md p-2 hover:bg-muted/50 transition-colors"
          style={{ paddingLeft: `${(chapter.level || 0) * 1.5}rem` }}
        >
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium truncate">{chapter.title}</h3>
            {chapter.slug && (
              <p className="text-xs text-muted-foreground truncate">
                /{chapter.slug}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100"
            asChild
          >
            <Link href={`#${chapter.slug || chapter.id}`}>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="sr-only">View {chapter.title}</span>
            </Link>
          </Button>
        </div>
      ))}
    </div>
  );
}
