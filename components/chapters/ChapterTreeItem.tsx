"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Folder, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChapterNode } from "@/types/chapters";

interface ChapterTreeItemProps {
  id: string;
  chapter: ChapterNode;
  level?: number;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  disabled?: boolean;
}

export function ChapterTreeItem({
  id,
  chapter,
  level = 0,
  isSelected = false,
  onSelect,
  disabled = false,
}: ChapterTreeItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    paddingLeft: `${level * 16}px`,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-2 py-2 px-3 rounded-md transition-colors",
        isSelected
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent/50",
        isDragging && "opacity-50",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-6 w-6 opacity-0 group-hover:opacity-100",
          isDragging && "opacity-100"
        )}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </Button>
      
      <div 
        className={cn(
          "flex-1 flex items-center gap-2 cursor-pointer",
          disabled && "cursor-not-allowed"
        )}
        onClick={() => onSelect?.(chapter.id)}
      >
        <div className="flex-1 truncate flex items-center">
          {chapter.children?.length ? (
            <Folder className="h-4 w-4 flex-shrink-0 mr-2" />
          ) : (
            <FileText className="h-4 w-4 flex-shrink-0 mr-2 opacity-50" />
          )}
          <span className="truncate">{chapter.title || 'Untitled Chapter'}</span>
        </div>
      </div>
      
      {isSelected && !disabled && (
        <span className="h-2 w-2 rounded-full bg-primary" />
      )}
    </div>
  );
}
