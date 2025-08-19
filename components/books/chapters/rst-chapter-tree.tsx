// components/books/chapters/rst-chapter-tree.tsx
'use client';

import React, { useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Eye, Pencil, Trash2, FileText } from 'lucide-react';
import { cn } from '@/lib/services/utils';
import { ChapterNode } from '@/lib/services/chapter-tree';
import { TreeView, type TreeDataItem } from '@/components/tree-view';

export interface RdtChapterTreeProps {
  chapters: ChapterNode[];
  onSave: (chapters: ChapterNode[]) => Promise<ChapterNode[] | void>;
  onSaveSuccess?: () => void;
  onEdit?: (id: string) => void;
  onView?: (id: string) => void;
  onDelete?: (id: string) => void | Promise<void>;
  className?: string;
  isSaving?: boolean;
}

export function RdtChapterTree({
  chapters,
  onSave,
  onSaveSuccess,
  onEdit,
  onView,
  onDelete,
  className,
  isSaving = false,
}: RdtChapterTreeProps) {
  // Extend TreeDataItem to include chapter-specific properties
interface ChapterTreeItem extends TreeDataItem {
  order?: number;
  parent_chapter_id?: string | null;
  updated_at?: string;
}

  // Convert chapters to tree nodes for TreeView
  const treeData = useMemo(() => {
    const rootItems: ChapterTreeItem[] = [];
    const itemsMap = new Map<string, ChapterTreeItem>();
    
    // First pass: create all items
    chapters.forEach(ch => {
      const item: ChapterTreeItem = {
        id: ch.id,
        name: ch.title,
        icon: FileText,
        order: ch.order,
        parent_chapter_id: ch.parent_chapter_id,
        onClick: () => onView?.(ch.id),
        actions: (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onView?.(ch.id);
              }}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(ch.id);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(ch.id);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
        children: [],
      };
      
      itemsMap.set(ch.id, item);
    });
    
    // Second pass: build hierarchy
    chapters.forEach(ch => {
      const item = itemsMap.get(ch.id);
      if (!item) return;
      
      if (ch.parent_chapter_id && itemsMap.has(ch.parent_chapter_id)) {
        const parent = itemsMap.get(ch.parent_chapter_id);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(item);
        }
      } else {
        rootItems.push(item);
      }
    });
    
    // Sort by order
    const sortByOrder = (items: ChapterTreeItem[]): ChapterTreeItem[] => {
      return [...items]
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(item => ({
          ...item,
          children: item.children ? sortByOrder(item.children) : []
        }));
    };
    
    return sortByOrder(rootItems);
  }, [chapters, onView, onEdit, onDelete]);

  // Handle adding a new chapter
  const handleAddChapter = useCallback(() => {
    onEdit?.('new');
  }, [onEdit]);

  // Handle drag and drop
  const handleDragAndDrop = useCallback(async (source: ChapterTreeItem, target: ChapterTreeItem) => {
    if (!chapters.length || !onSave) return;
    
    try {
      // Update the parent_chapter_id of the dragged item
      const updatedChapters = chapters.map(ch => {
        if (ch.id === source.id) {
          return {
            ...ch,
            parent_chapter_id: target.id,
            updated_at: new Date().toISOString()
          };
        }
        return ch;
      });
      
      // Trigger save
      await onSave(updatedChapters);
      
      // Call success callback if provided
      onSaveSuccess?.();
    } catch (error) {
      console.error('Error updating chapter hierarchy:', error);
    }
  }, [chapters, onSave, onSaveSuccess]);

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Chapters</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddChapter}
          disabled={isSaving}
        >
          Add Chapter
        </Button>
      </div>
      
      <div className="border rounded-md overflow-hidden">
        <TreeView 
          data={treeData}
          onDocumentDrag={handleDragAndDrop}
          className="p-2"
          onSelectChange={(item) => {
            if (item) {
              onView?.(item.id);
            }
          }}
        />
      </div>
    </div>
  );
}

export default RdtChapterTree;