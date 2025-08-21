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
  // Add debug logging for initial chapters
  React.useEffect(() => {
    console.log('Initial chapters:', initialChapters);
    const tree = convertChaptersToTree(initialChapters);
    console.log('Converted tree:', JSON.stringify(tree, null, 2));
  }, [initialChapters]);

  const [treeData, setTreeData] = useState<TreeViewItem[]>(() => {
    const tree = convertChaptersToTree(initialChapters);
    return tree;
  });
  
  const updateChapterOrder = useUpdateChapterOrder(bookId);
  const [isUpdating, setIsUpdating] = useState(false);
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  // Handle tree changes and persist order
  const handleTreeChange = useCallback((newTree: TreeViewItem[]) => {
    setTreeData(newTree);
    
    // Auto-save the new order when tree changes
    const updates = buildOrderPayload(newTree, bookId);
    updateChapterOrder.mutate(updates, {
      onError: (error) => {
        console.error("Error updating chapter order:", error);
        toast.error("Failed to update chapter order");
      }
    });
  }, [bookId, updateChapterOrder]);

  // Handle item movement
  const handleMoveItem = useCallback(async (
    item: TreeViewItem, 
    newParentId: string | null, 
    newIndex: number
  ) => {
    try {
      setIsUpdating(true);
      
      // The actual tree update is handled by the TreeView component
      // We don't need to do anything here as handleTreeChange will be called
      // with the updated tree structure
      
      // Show loading state for better UX
      toast.loading("Updating chapter order...");
      
      // The actual save happens in handleTreeChange
      // which is called automatically by the TreeView component
      
    } catch (error) {
      console.error("Error moving chapter:", error);
      toast.error("Failed to move chapter");
      
      // Revert to the previous state on error
      setTreeData(convertChaptersToTree(initialChapters));
    } finally {
      setIsUpdating(false);
    }
  }, [bookId, initialChapters, treeData, updateChapterOrder]);

  // Auto-expand all nodes initially
  React.useEffect(() => {
    const allIds = new Set<string>();
    const collectIds = (items: TreeViewItem[]) => {
      items.forEach(item => {
        allIds.add(item.id);
        if (item.children?.length) {
          collectIds(item.children);
        }
      });
    };
    collectIds(treeData);
    setExpandedIds(allIds);
  }, [treeData]);

  return (
    <div className="space-y-2 relative">
      <div className="text-sm text-muted-foreground mb-2">
        {treeData.length} chapters loaded • {expandedIds.size} expanded nodes
      </div>
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
        <div className="border rounded-md p-2 bg-background/50">
          <TreeView
            data={treeData}
            onTreeChange={handleTreeChange}
            onMoveItem={handleMoveItem}
            getIcon={(item: TreeViewItem, depth: number) => (
              <Folder className="h-4 w-4 text-primary/80" />
            )}
            className="min-h-[300px]"
            menuItems={[
              {
                id: "view",
                label: "View",
                icon: <Eye className="h-4 w-4" />,
                action: (items: TreeViewItem[]) => {
                  if (items.length) {
                    window.location.href = `/dashboard/books/${bookId}/chapters/${items[0].id}`;
                  }
                },
              },
              {
                id: "edit",
                label: "Edit",
                icon: <Pencil className="h-4 w-4" />,
                action: (items: TreeViewItem[]) => {
                  if (items.length) {
                    window.location.href = `/dashboard/books/${bookId}/chapters/${items[0].id}/edit`;
                  }
                },
              },
            ]}
            onAction={(action: string, items: TreeViewItem[]) => {
              // Handle actions if needed
              console.log("Action:", action, items);
            }}
          />
        </div>
      </div>
    </div>
  );
}
