// components/chapters/ChapterTree.tsx
"use client";

import * as React from "react";
import { useCallback, useState } from "react";
import TreeView, { TreeViewItem } from "@/components/tree-view";
import { convertChaptersToTree, buildOrderPayload } from "@/lib/convert-chapters";
import type { Chapter } from "@/types/chapter";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Plus, Folder, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useUpdateChapterOrder } from "@/hooks/api/use-chapters";

interface ChapterTreeWrapperProps {
  initialChapters: Chapter[];
  bookId: string;
}

export function ChapterTreeWrapper({ initialChapters, bookId }: ChapterTreeWrapperProps) {
  const [treeData, setTreeData] = useState<TreeViewItem[]>(() => 
    convertChaptersToTree(initialChapters)
  );
  const updateChapterOrder = useUpdateChapterOrder(bookId);
  const [isUpdating, setIsUpdating] = useState(false);

  // Handle tree changes and persist order
  const handleTreeChange = useCallback((newTree: TreeViewItem[]) => {
    setTreeData(newTree);
  }, []);

  // Handle item movement
  const handleMoveItem = useCallback(async (
    item: TreeViewItem, 
    newParentId: string | null, 
    newIndex: number
  ) => {
    try {
      setIsUpdating(true);
      
      // Prepare the updates for the server
      const updates = buildOrderPayload(treeData, bookId);
      
      // Send the updates to the server
      await updateChapterOrder.mutateAsync(updates);
      
      toast.success("Chapter order updated successfully");
    } catch (error) {
      console.error("Error updating chapter order:", error);
      toast.error("Failed to update chapter order");
      
      // Revert to the previous state on error
      setTreeData(convertChaptersToTree(initialChapters));
    } finally {
      setIsUpdating(false);
    }
  }, [bookId, initialChapters, treeData, updateChapterOrder]);

  return (
    <div className="space-y-2 relative">
      {isUpdating && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      <div className="space-y-2">
        <div className="flex items-center justify-between w-full px-2">
          <span className="text-sm font-medium">Chapters</span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8"
            asChild
          >
            <Link href={`/dashboard/books/${bookId}/chapters/new`}>
              <Plus className="h-4 w-4 mr-1" /> New Chapter
            </Link>
          </Button>
        </div>
        <TreeView
          data={treeData}
          title=""
          iconMap={{ chapter: <Folder className="h-4 w-4 text-primary/80" /> }}
          onMoveItem={handleMoveItem}
          menuItems={[
            {
              id: "view",
              label: "View",
              icon: <Eye className="h-4 w-4" />,
              action: (items) => {
                if (items.length) {
                  window.location.href = `/dashboard/books/${bookId}/chapters/${items[0].id}`;
                }
              },
            },
            {
              id: "edit",
              label: "Edit",
              icon: <Pencil className="h-4 w-4" />,
              action: (items) => {
                if (items.length) {
                  window.location.href = `/dashboard/books/${bookId}/chapters/${items[0].id}/edit`;
                }
              },
            },
          ]}
          onAction={(action, items) => {
            // Handle actions if needed
            console.log("Action:", action, items);
          }}
          onTreeChange={async (newTree) => {
            // Update local state
            handleTreeChange(newTree);
            
            // Persist changes to server
            try {
              setIsUpdating(true);
              const updates = buildOrderPayload(newTree, bookId);
              await updateChapterOrder.mutateAsync(updates);
              toast.success("Chapter order updated");
            } catch (error) {
              console.error("Error updating chapter order:", error);
              toast.error("Failed to update chapter order");
              // Revert to previous state on error
              setTreeData(convertChaptersToTree(initialChapters));
            } finally {
              setIsUpdating(false);
            }
          }}
        />
      </div>
    </div>
  );
}
