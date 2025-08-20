"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { ChapterNode } from "@/types/chapters";
import { ChapterTreeItem } from "@/components/chapters/ChapterTreeItem";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { sortByOrder } from "@/lib/tree-utils";

// Match the API's expected format
export interface ChapterUpdate {
  id: string;
  order: number;
  level: number;
  parentChapterId: string | null; // Match API's expected format
}

interface ChapterTreeProps {
  bookId: string;
  chapters: ChapterNode[];
  onSelect?: (chapterId: string) => void;
  selectedId?: string;
  onSave?: (updates: ChapterUpdate[]) => Promise<void>;
}

export function ChapterTree({
  bookId,
  chapters,
  onSelect,
  selectedId,
  onSave,
}: ChapterTreeProps) {
  const [items, setItems] = useState<ChapterNode[]>(() => [...chapters].sort(sortByOrder));
  const queryClient = useQueryClient();

  useEffect(() => {
    setItems([...chapters].sort(sortByOrder));
  }, [chapters]);

  const reorderMutation = useMutation({
    mutationFn: async (updates: ChapterUpdate[]) => {
      if (onSave) {
        await onSave(updates);
      } else {
        const res = await fetch('/api/chapters/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookId, patches: updates })
        });

        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          throw new Error(error.message || 'Failed to reorder chapters');
        }

        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters', bookId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reorder chapters');
      setItems([...chapters].sort(sortByOrder)); // rollback
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) return;

      setItems((currentItems) => {
        const oldIndex = currentItems.findIndex((item) => item.id === active.id);
        const newIndex = currentItems.findIndex((item) => item.id === over!.id);

        if (oldIndex === -1 || newIndex === -1) return currentItems;

        const newItems = arrayMove(currentItems, oldIndex, newIndex);

        // ✅ Assign new order, preserve parent_chapter_id
        const updatedItems = newItems.map((item, index) => ({
          ...item,
          order: index,
          // Only use existing snake_case field
        }));

        // Prepare update payload matching the API's expected format
        const updates = updatedItems.map((item) => ({
          id: item.id,
          order: item.order,
          level: item.level,
          parentChapterId: item.parent_chapter_id, // Match API's expected format
        }));

        reorderMutation.mutate(updates);

        return updatedItems;
      });
    },
    [reorderMutation]
  );

  // Build a tree structure
  const buildTree = (items: ChapterNode[], parentId: string | null = null): ChapterNode[] => {
    return items
      .filter(item => item.parent_chapter_id === parentId)
      .sort(sortByOrder)
      .map(item => ({
        ...item,
        children: buildTree(items, item.id)
      }));
  };

  // Create a flat map for sorting context
  const itemsForSorting = useMemo(() => {
    return items.map((item) => ({
      id: item.id,
      order: item.order,
      level: item.level,
      parent_chapter_id: item.parent_chapter_id,
    }));
  }, [items]);

  // Build the tree structure
  const tree = useMemo(() => buildTree(items), [items]);

  // Recursive function to render tree items
  const renderTreeItems = (nodes: ChapterNode[], level: number = 0) => {
    return nodes.map((node) => (
      <div key={node.id}>
        <ChapterTreeItem
          id={node.id}
          chapter={node}
          level={level}
          onSelect={onSelect}
          isSelected={selectedId === node.id}
          disabled={reorderMutation.isPending}
        />
        {node.children && node.children.length > 0 && (
          <div className="ml-4">
            {renderTreeItems(node.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="space-y-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis]}
      >
        <SortableContext items={itemsForSorting} strategy={verticalListSortingStrategy}>
          {renderTreeItems(tree)}
        </SortableContext>
      </DndContext>
      {reorderMutation.isPending && (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="ml-2 text-sm text-muted-foreground">Saving changes...</span>
        </div>
      )}
    </div>
  );
}