"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Folder, FileText, ChevronRight, Eye, Pencil } from "lucide-react";
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
  selectedId?: string;
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

  const hasChildren = chapter.children && chapter.children.length > 0;
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex flex-col rounded-md transition-colors",
        isSelected ? "bg-accent/20" : "hover:bg-accent/10",
        isDragging && "opacity-50",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <div className="flex items-center gap-2 p-2">
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
            "flex-1 flex items-center gap-2 cursor-pointer min-w-0",
            disabled && "cursor-not-allowed"
          )}
          onClick={() => onSelect?.(chapter.id)}
        >
          {hasChildren ? (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="h-4 w-4 flex-shrink-0 flex items-center justify-center"
            >
              <ChevronRight className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")} />
            </button>
          ) : (
            <div className="w-4 h-4 flex-shrink-0" />
          )}
          
          <div className="flex-1 truncate flex items-center gap-2">
            {hasChildren ? (
              <Folder className="h-4 w-4 flex-shrink-0 text-yellow-500" />
            ) : (
              <FileText className="h-4 w-4 flex-shrink-0 text-blue-500" />
            )}
            <span className="truncate flex-1">{chapter.title || 'Untitled Chapter'}</span>
            {hasChildren && (
              <span className="text-xs text-muted-foreground mr-2">
                {chapter.children?.length} {chapter.children?.length === 1 ? 'chapter' : 'chapters'}
              </span>
            )}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  // TODO: Add view chapter logic
                  console.log('View chapter:', chapter.id);
                }}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  // TODO: Add edit chapter logic
                  console.log('Edit chapter:', chapter.id);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
        
        {isSelected && !disabled && (
          <span className="h-2 w-2 rounded-full bg-primary" />
        )}
      </div>
      
      {hasChildren && isExpanded && (
        <div className="ml-8 border-l-2 border-muted pl-2">
          {chapter.children?.map((child) => (
            <ChapterTreeItem
              key={child.id}
              id={child.id}
              chapter={child}
              level={level + 1}
              onSelect={onSelect}
              isSelected={isSelected}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}
