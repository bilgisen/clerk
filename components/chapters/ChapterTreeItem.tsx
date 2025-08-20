// components/chapters/ChapterTreeItem.tsx
"use client";

import { FileText, Eye, Pencil, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export type ChapterNode = {
  id: string;
  title: string;
  slug: string;
  content?: string;
  order: number;
  level: number;
  parent_chapter_id: string | null;
  book_id: string;
  created_at?: string;
  updated_at?: string;
};

type ChapterTreeItemProps = {
  id: string;
  chapter: ChapterNode;
  depth: number;
  isSelected: boolean;
  isOpen: boolean;
  hasChildren: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
};

export function ChapterTreeItem({
  id,
  chapter,
  depth,
  isSelected,
  isOpen,
  hasChildren,
  onToggle,
  onSelect,
}: ChapterTreeItemProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(id);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle();
  };

  return (
    <div
      className={cn(
        "group flex items-center justify-between rounded-lg p-2 hover:bg-accent/50 transition-colors",
        isSelected && "bg-accent"
      )}
      style={{ 
        paddingLeft: `${depth * 16 + 8}px`,
        borderLeft: isSelected ? '2px solid #3b82f6' : '2px solid transparent'
      }}
      onClick={handleClick}
    >
      <div className="flex items-center flex-1 min-w-0">
        {hasChildren ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 mr-1"
            onClick={handleToggle}
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        ) : (
          <div className="w-6 mr-1" />
        )}
        
        <FileText className="h-4 w-4 text-muted-foreground mr-2 flex-shrink-0" />
        <span className="text-sm font-medium truncate">{chapter.title}</span>
      </div>
      
      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          asChild
          onClick={(e) => e.stopPropagation()}
        >
          <Link href={`/dashboard/books/${chapter.book_id}/chapters/${chapter.id}`}>
            <Eye className="h-3.5 w-3.5" />
            <span className="sr-only">View chapter</span>
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          asChild
          onClick={(e) => e.stopPropagation()}
        >
          <Link href={`/dashboard/books/${chapter.book_id}/chapters/${chapter.id}/edit`}>
            <Pencil className="h-3.5 w-3.5" />
            <span className="sr-only">Edit chapter</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
