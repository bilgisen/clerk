"use client";

import { useState, useEffect, useCallback } from "react";
import { Tree, NodeModel, DropOptions } from "@minoru/react-dnd-treeview";
import { ChapterTreeItem, ChapterNode } from "./ChapterTreeItem";
import { ChapterNode as ApiChapterNode } from "@/types/dnd";
import { useUpdateChapterOrder } from "@/hooks/api/use-chapters";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

// Convert the API response to the tree format
const convertToTreeData = (chapters: ApiChapterNode[]): NodeModel<ChapterNode>[] => {
  return chapters.map(chapter => ({
    id: chapter.id,
    parent: chapter.parent_chapter_id || "0", // "0" means root level
    text: chapter.title,
    droppable: true,
    data: {
      id: chapter.id,
      title: chapter.title,
      content: chapter.content || "",
      order: chapter.order || 0,
      level: chapter.level || 0,
      parent_chapter_id: chapter.parent_chapter_id || null,
      slug: chapter.slug || "",
      book_id: chapter.book_id || "",
      created_at: chapter.created_at || "",
      updated_at: chapter.updated_at || ""
    }
  }));
};

interface ChapterTreeWrapperProps {
  initialChapters?: ApiChapterNode[];
  bookId: string;
}

export function ChapterTreeWrapper({ initialChapters = [], bookId }: ChapterTreeWrapperProps) {
  const [treeData, setTreeData] = useState<NodeModel<ChapterNode>[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const updateChapterOrder = useUpdateChapterOrder(bookId);

  // Update tree data when initialChapters change
  useEffect(() => {
    if (initialChapters?.length > 0) {
      setTreeData(convertToTreeData(initialChapters));
      // Auto-expand first level by default
      const firstLevelIds = initialChapters
        .filter(ch => !ch.parent_chapter_id)
        .map(ch => ch.id);
      setOpenIds(new Set(firstLevelIds));
    } else {
      setTreeData([]);
      setOpenIds(new Set());
    }
  }, [initialChapters]);

  const handleToggle = useCallback((id: string) => {
    setOpenIds(prev => {
      const newOpenIds = new Set(prev);
      if (newOpenIds.has(id)) {
        newOpenIds.delete(id);
      } else {
        newOpenIds.add(id);
      }
      return newOpenIds;
    });
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(prevId => prevId === id ? null : id);
  }, []);

  const handleDrop = useCallback(async (newTree: NodeModel<ChapterNode>[], options: DropOptions) => {
    // Update the local state immediately for a smooth UI experience
    setTreeData(newTree);
    
    // Extract the updates needed for the API
    const updates = newTree
      .filter(node => node.data) // Ensure we have data
      .map((node, index) => ({
        id: node.data!.id,
        order: index, // Use array index as order
        level: 0, // Will be calculated on the server
        parent_chapter_id: node.parent === "0" ? null : node.parent as string
      }));
    
    try {
      await updateChapterOrder.mutateAsync(updates);
      toast.success("Chapter order updated");
    } catch (error) {
      console.error("Failed to update chapter order:", error);
      toast.error("Failed to update chapter order");
      // Revert to previous state on error
      if (initialChapters?.length) {
        setTreeData(convertToTreeData(initialChapters));
      }
    }
  }, [initialChapters, updateChapterOrder]);

  // Custom render prop for the tree items
  const renderNode = useCallback((node: NodeModel<ChapterNode>, { depth }: { depth: number }) => {
    if (!node.data) {
      // Return a minimal valid React element when there's no data
      return <div />;
    }
    
    return (
      <ChapterTreeItem
        id={node.id as string}
        chapter={node.data}
        depth={depth}
        isSelected={selectedId === node.id}
        isOpen={openIds.has(node.id as string)}
        hasChildren={node.droppable || false}
        onToggle={() => handleToggle(node.id as string)}
        onSelect={handleSelect}
      />
    );
  }, [selectedId, openIds, handleToggle, handleSelect]);

  if (treeData.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        No chapters found. Add your first chapter to get started.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Tree
        tree={treeData}
        rootId="0"
        render={renderNode}
        onDrop={handleDrop}
        classes={{
          root: "space-y-1",
          dropTarget: "bg-accent/50",
          listItem: "mb-1",
        }}
        sort={false}
        insertDroppableFirst={false}
        canDrop={(tree, { dragSource, dropTargetId }) => {
          // Prevent dropping a chapter onto itself or its own children
          if (dragSource?.id === dropTargetId) {
            return false;
          }
          return true;
        }}
        dropTargetOffset={10}
        placeholderRender={(node, { depth }) => (
          <div
            className="h-1 bg-primary rounded-full mx-2"
            style={{ marginLeft: depth * 16 + 28 }}
          />
        )}
      />
      
      {/* Add Chapter Button */}
      <div className="mt-4 pl-8">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          asChild
        >
          <Link href={`/dashboard/books/${bookId}/chapters/new`}>
            <Plus className="h-4 w-4" />
            Add Chapter
          </Link>
        </Button>
      </div>
    </div>
  );
}
