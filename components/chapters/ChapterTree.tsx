// components/chapters/ChapterTree.tsx
"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { TreeView } from "@/components/tree-view";
import type { TreeViewItem } from "@/components/tree-view";
import { convertChaptersToTree, buildOrderPayload } from "@/lib/convert-chapters";
import type { Chapter } from "@/types/chapter";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Plus, Folder, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useUpdateChapterOrder } from "@/hooks/api/use-chapters";

// Add missing JSX elements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      div: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
      span: React.DetailedHTMLProps<React.HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>;
      button: React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>;
    }
  }
}

interface ChapterTreeWrapperProps {
  initialChapters: Chapter[] | Chapter[];
  bookId: string;
}

// Extend Chapter type to include children for tree structure
type ChapterWithChildren = Chapter & {
  children?: ChapterWithChildren[];
};

export function ChapterTreeWrapper({ initialChapters, bookId }: ChapterTreeWrapperProps) {
  // Convert initial chapters to tree structure
  const initialTree = useMemo(() => {
    return convertChaptersToTree(initialChapters);
  }, [initialChapters]);

  // State for the tree data
  const [treeData, setTreeData] = useState<TreeViewItem[]>(initialTree);
  
  // Update tree data when initial data changes
  useEffect(() => {
    setTreeData(initialTree);
  }, [initialTree]);
  
  // Initialize update chapter order mutation
  const updateChapterOrder = useUpdateChapterOrder(bookId);
  const [isUpdating, setIsUpdating] = useState(false);

  // Handle tree changes and persist order
  const handleTreeChange = useCallback((newTree: TreeViewItem[]) => {
    console.log('Tree changed, updating order...');
    
    // Update local state immediately for responsive UI
    setTreeData(newTree);
    
    try {
      // Build the order payload
      const updates = buildOrderPayload(newTree, bookId);
      
      if (!updates || updates.length === 0) {
        console.warn('No updates to send');
        return;
      }
      
      // Log the updates for debugging
      console.log('Sending order updates:', updates);
      
      // Update the order on the server
      updateChapterOrder.mutate(updates, {
        onError: (error: Error) => {
          console.error("Error updating chapter order:", error);
          toast.error("Failed to update chapter order");
          // Revert to the previous state on error
          setTreeData(convertChaptersToTree(initialChapters));
        },
        onSuccess: () => {
          console.log('Chapter order updated successfully');
          toast.success("Chapter order updated");
        }
      });
    } catch (error) {
      console.error('Error in handleTreeChange:', error);
      toast.error("An error occurred while updating the chapter order");
      // Revert to the previous state on error
      setTreeData(convertChaptersToTree(initialChapters));
    }
  }, [bookId, updateChapterOrder]);

  // Handle item movement
  const handleMoveItem = useCallback(async (
    item: TreeViewItem, 
    newParentId: string | null, 
    newIndex: number
  ) => {
    try {
      setIsUpdating(true);
      console.log(`Moving item ${item.id} to parent ${newParentId} at index ${newIndex}`);
      
      // Show loading state
      const toastId = "move-item-toast";
      toast.loading("Updating chapter order...", { id: toastId });
      
      // Update the tree data with the new parent/position
      setTreeData((prevTree) => {
        // Create a deep copy of the tree
        const newTree = JSON.parse(JSON.stringify(prevTree)) as TreeViewItem[];
        
        // Create a deep copy of the item to move
        const itemToMove = JSON.parse(JSON.stringify(item)) as TreeViewItem;
        
        // Update the item's parent reference
        itemToMove.data = {
          ...itemToMove.data,
          parent_chapter_id: newParentId,
          parentChapterId: newParentId
        };
        
        // Find and remove the item from its current position
        const removeItem = (items: TreeViewItem[]): boolean => {
          for (let i = 0; i < items.length; i++) {
            if (items[i].id === item.id) {
              items.splice(i, 1);
              return true;
            }
            if (items[i]?.children?.length) {
              if (removeItem(items[i].children!)) return true;
            }
          }
          return false;
        };
        
        // Find the new parent and insert the item
        const insertItem = (items: TreeViewItem[], parentId: string | null): boolean => {
          // If parentId is null, insert at root level
          if (parentId === null) {
            const insertIndex = Math.min(Math.max(0, newIndex), items.length);
            items.splice(insertIndex, 0, itemToMove);
            return true;
          }
          
          // Find the parent and insert as a child
          for (const current of items) {
            if (current.id === parentId) {
              if (!current.children) {
                current.children = [];
              }
              const insertIndex = Math.min(Math.max(0, newIndex), current.children.length);
              current.children.splice(insertIndex, 0, itemToMove);
              return true;
            }
            if (current.children?.length) {
              if (insertItem(current.children, parentId)) return true;
            }
          }
          return false;
        };
        
        // Perform the move operation
        removeItem(newTree);
        const insertResult = insertItem(newTree, newParentId);
        
        if (!insertResult) {
          console.warn('Failed to insert item, adding to root');
          newTree.push(itemToMove);
        }
        
        return newTree;
      });
      
      // The actual save will be handled by handleTreeChange
      // which is called automatically by the TreeView component
      toast.success("Chapter order updated", { id: toastId });
      
    } catch (error) {
      console.error("Error moving chapter:", error);
      toast.error("Failed to move chapter");
      
      // Revert to the previous state on error
      setTreeData(convertChaptersToTree(initialChapters));
    } finally {
      setIsUpdating(false);
    }
  }, [bookId, initialChapters, treeData, updateChapterOrder]);

  // The TreeView component now handles its own expanded state internally

  const renderItemActions = useCallback((item: TreeViewItem) => {
    return (
      <div className="flex space-x-1">
        <Button 
          variant="ghost" 
          size="sm" 
          asChild
          disabled={isUpdating}
        >
          <Link href={`/dashboard/books/${bookId}/chapters/${item.id}`}>
            <Pencil className="h-4 w-4" />
          </Link>
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          asChild
          disabled={isUpdating}
        >
          <Link href={`/books/${bookId}/chapters/${item.id}`} target="_blank">
            <Eye className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    );
  }, [bookId, isUpdating]);

  return (
    <div className="space-y-2 relative">
      <div className="text-sm text-muted-foreground mb-2">
        {treeData.length === 0 ? 'No chapters found' : `${treeData.length} chapters`}
      </div>

      {isUpdating && (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Updating chapter order...</span>
        </div>
      )}

      <div className="rounded-md border">
        <TreeView
          data={treeData}
          onTreeChange={handleTreeChange}
          onMoveItem={handleMoveItem}
          showCheckboxes={false}
          showExpandAll={true}
          selectionText="selected"
          searchPlaceholder="Search chapters..."
          iconMap={{
            folder: <Folder className="h-4 w-4 text-primary/80" />,
            file: <Pencil className="h-4 w-4 text-muted-foreground" />,
            chapter: <Folder className="h-4 w-4 text-primary/80" />
          }}
          checkboxLabels={{
            check: 'Check all',
            uncheck: 'Uncheck all'
          }}
          onSelectionChange={(selectedItems) => {
            // Handle selection changes if needed
            console.log('Selected items:', selectedItems);
          }}
          onAction={(action, items) => {
            // Handle actions if needed
            console.log('Action:', action, 'on items:', items);
          }}
          onCheckChange={(item, checked) => {
            // Handle checkbox changes if needed
            console.log('Checkbox changed for item:', item.id, 'checked:', checked);
          }}
          menuItems={[]}
          title="Chapters"
          checkboxPosition="left"
        />
      </div>

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted-foreground">Debug Info</summary>
          <div className="mt-2 p-2 bg-muted/10 rounded text-xs overflow-auto max-h-60">
            <h4 className="font-medium mb-1">Initial Chapters:</h4>
            <pre>{JSON.stringify(initialChapters, null, 2)}</pre>
            <h4 className="font-medium mt-2 mb-1">Tree Data:</h4>
            <pre>{JSON.stringify(treeData, null, 2)}</pre>
          </div>
        </details>
      )}
    </div>
  );
}
