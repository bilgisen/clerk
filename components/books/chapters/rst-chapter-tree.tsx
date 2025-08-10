// components/books/chapters/rst-chapter-tree.tsx
'use client';

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { Tree, NodeModel, DropOptions, DragLayerMonitorProps } from '@minoru/react-dnd-treeview';
import { Button } from '@/components/ui/button';
import { Eye, Pencil, Trash2, ChevronRight, ChevronDown, GripVertical } from 'lucide-react';
import { cn } from '@/lib/services/utils';
import { ChapterNode, calculateLevelsAndOrders, treeToChapters, sortTreeDataByVisualOrder } from '@/lib/services/chapter-tree';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export interface RdtChapterTreeProps {
  chapters: ChapterNode[];
  onSave: (chapters: ChapterNode[]) => Promise<ChapterNode[] | void>;
  onSaveSuccess?: () => void;
  onEdit?: (id: string) => void;
  onView?: (id: string) => void;
  onDelete?: (id: string) => void | Promise<void>;
  className?: string;
  isSaving?: boolean;
  dndContext?: React.ReactNode; // Allow passing DnD context from parent
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
  dndContext,
}: RdtChapterTreeProps) {
  // Convert chapters to tree nodes with proper typing
  const nodes = useMemo(() => 
    chapters.map((ch) => ({
      id: ch.id,
      parent: ch.parent_chapter_id || 0, // Use 0 as root parent ID
      text: ch.title,
      droppable: true,
      data: {
        ...ch,
        // Ensure all required fields are present
        id: ch.id,
        title: ch.title,
        slug: ch.slug,
        book_id: ch.book_id,
        parent_chapter_id: ch.parent_chapter_id,
        order: ch.order || 0,
        level: ch.level || 0,
        created_at: ch.created_at || new Date().toISOString(),
        updated_at: ch.updated_at || new Date().toISOString(),
      },
    })),
    [chapters]
  );

  // State to track the tree data
  const [treeData, setTreeData] = useState<NodeModel<ChapterNode>[]>([]);

  // Update tree data when nodes change
  useEffect(() => {
    if (nodes.length > 0) {
      const calculatedTree = calculateLevelsAndOrders(nodes);
      setTreeData(calculatedTree);
    } else {
      setTreeData([]);
    }
  }, [nodes]);

  // State to track if the tree has changes
  const [hasChanges, setHasChanges] = useState(false);
  const [isSavingState, setIsSaving] = useState(false);

  // Handle drop event
  const handleDrop = useCallback(async (newTree: NodeModel<ChapterNode>[], options: DropOptions) => {
    if (!chapters.length) return;
    
    try {
      // Create a deep copy to avoid mutating the original data
      const newTreeCopy = JSON.parse(JSON.stringify(newTree));
      
      // 1. First, calculate new levels and orders for the new tree structure
      const newTreeWithLevels = calculateLevelsAndOrders([...newTreeCopy]);
      
      // 2. Convert to flat chapters for saving
      const updatedChapters = treeToChapters(
        newTreeWithLevels,
        chapters[0]?.book_id || ''
      );
      
      // Log the final payload for debugging
      console.log('✅ Updated chapters with new order:', 
        updatedChapters.map(ch => ({
          id: ch.id, 
          order: ch.order, 
          parent: ch.parent_chapter_id,
          title: ch.title
        }))
      );
      
      // 3. Update local state with the new tree immediately for better UX
      setTreeData(newTreeWithLevels);
      setHasChanges(true);
      
      // 4. Save the changes to the server
      if (onSave) {
        try {
          setIsSaving(true);
          const result = await onSave(updatedChapters);
          
          if (result) {
            // If the save was successful, update the tree with the server response
            const savedTreeData = calculateLevelsAndOrders(
              result.map(ch => ({
                id: ch.id,
                parent: ch.parent_chapter_id || 0,
                text: ch.title,
                droppable: true,
                data: {
                  ...ch,
                  created_at: ch.created_at || new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }
              }))
            );
            setTreeData(savedTreeData);
            
            // Call the success callback if provided
            if (onSaveSuccess) {
              onSaveSuccess();
            }
          }
          setHasChanges(false);
        } catch (error) {
          console.error('Error saving chapter order:', error);
          // Revert to previous state on error
          const previousTree = calculateLevelsAndOrders(nodes);
          setTreeData(previousTree);
          throw error;
        } finally {
          setIsSaving(false);
        }
      }
    } catch (error) {
      console.error('Error handling drop:', error);
      // Revert to the previous tree data on error
      const previousTree = calculateLevelsAndOrders(nodes);
      setTreeData(previousTree);
    }
  }, [chapters, onSave]);

  // Handle save button click
  const handleSaveClick = useCallback(async () => {
    if (!chapters.length || !hasChanges) return;
    
    try {
      setIsSaving(true);
      
      // Calculate new levels and orders for the entire tree
      const updatedTree = calculateLevelsAndOrders(treeData);
      
      // Convert the tree back to chapter format
      const updatedChapters = treeToChapters(
        updatedTree,
        chapters[0]?.book_id || ''
      );
      
      // Call the save handler with the updated chapters
      const result = await onSave(updatedChapters);
      
      // Update the tree with the server's response if available, otherwise use the original chapters
      const savedChapters = Array.isArray(result) ? result : updatedChapters;
      
      const newTreeData = calculateLevelsAndOrders(
        savedChapters.map((ch: ChapterNode) => ({
          id: ch.id,
          parent: ch.parent_chapter_id || 0,
          text: ch.title,
          droppable: true,
          data: {
            ...ch,
            created_at: ch.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
        }))
      );
      
      setTreeData(newTreeData);
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving chapter order:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [chapters, hasChanges, onSave, treeData]);

  // Custom drag preview component
  const CustomDragPreview = useCallback(({ monitorProps }: { monitorProps: DragLayerMonitorProps<ChapterNode> }) => {
    const item = monitorProps.item;
    return (
      <div className="bg-background">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{item.text}</span>
        </div>
      </div>
    );
  }, []);

  // Custom render for each tree node
  const renderNode = useCallback((node: NodeModel<ChapterNode>, { depth, isOpen, onToggle, hasChild, isDragging }: {
    depth: number; 
    isOpen: boolean; 
    onToggle: () => void;
    hasChild: boolean;
    isDragging: boolean;
  }) => {
    const hasChildren = node.droppable && (node as any).children?.length > 0;
    
    return (
      <div 
        className={cn(
          'flex items-center justify-between w-full py-2 px-3 rounded-md hover:bg-accent/50 transition-colors',
          'group/item',
          {
            'bg-accent/30': depth > 0,
            'opacity-50': isDragging,
          }
        )}
        style={{ 
          marginLeft: depth * 20,
          paddingLeft: depth > 0 ? 12 : 0,
        }}
      >
        <div className="flex items-center flex-1 min-w-0">
          <div 
            className="p-1 -ml-2 mr-1 rounded-md hover:bg-accent/50"
            style={{
              cursor: 'grab',
              opacity: 0.7,
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              // Prevent text selection during drag
              e.preventDefault();
            }}
            onDragStart={(e) => {
              e.stopPropagation();
            }}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          
          {hasChildren && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="p-1 -ml-1 mr-1 rounded-md hover:bg-accent/50"
            >
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          )}
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onView) onView(String(node.id));
            }}
            className="truncate font-medium text-foreground hover:underline text-left"
          >
            {node.text}
          </button>
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
          {onView && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onView(String(node.id));
              }}
              title="View"
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(String(node.id));
              }}
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(String(node.id));
              }}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }, [onView, onEdit, onDelete]);

  // Render the tree component
  const renderTree = () => (
    <Tree
      tree={treeData}
      rootId={0}
      onDrop={handleDrop}
      render={renderNode}
      classes={{
        root: 'p-2 space-y-1',
        container: 'space-y-1',
        listItem: 'mb-1',
        dropTarget: 'bg-accent/50',
        draggingSource: 'opacity-30',
        placeholder: 'h-8 bg-primary/10 rounded-md border-2 border-dashed border-primary/30',
      }}
      sort={false}
      insertDroppableFirst={true}
      canDrop={(tree, { dragSource, dropTargetId }) => {
        if (!dragSource) return false;
        
        // Prevent dropping a node into itself
        if (dragSource.id === dropTargetId) {
          return false;
        }
        
        // Prevent dropping a node into its own children
        const isDroppingIntoSelf = (parentId: string | number | null): boolean => {
          if (parentId === dragSource.id) return true;
          if (parentId === null || parentId === 0) return false;
          
          const parentNode = tree.find(n => n.id === parentId);
          return parentNode ? isDroppingIntoSelf(parentNode.parent) : false;
        };
        
        return !isDroppingIntoSelf(dropTargetId);
      }}
      dropTargetOffset={5}
      placeholderRender={(node, { depth }) => (
        <div 
          className="h-8 bg-primary/10 rounded-md border-2 border-dashed border-primary/30"
          style={{
            marginLeft: depth * 20,
            paddingLeft: depth > 0 ? 12 : 0,
          }}
        />
      )}
      dragPreviewRender={(monitorProps) => (
        <CustomDragPreview monitorProps={monitorProps} />
      )}
      onDragStart={() => {
        // Add a class to the body to change cursor
        document.body.classList.add('cursor-grabbing');
        document.body.classList.add('select-none');
      }}
      onDragEnd={() => {
        // Remove cursor class when drag ends
        document.body.classList.remove('cursor-grabbing');
        document.body.classList.remove('select-none');
        
        // Remove any drop target classes
        document.querySelectorAll('.dropTarget').forEach(el => {
          el.classList.remove('dropTarget');
        });
      }}
    />
  );

  return (
    <div className={cn('flex flex-col h-[600px] border rounded-sm bg-background/50', className)}>
      <div className="flex-1 overflow-auto">
        {renderTree()}
      </div>
      <style dangerouslySetInnerHTML={{
        __html: `
          body.cursor-grabbing {
            cursor: grabbing !important;
          }
          .cursor-grabbing * {
            cursor: grabbing !important;
          }
          .select-none {
            user-select: none;
            -webkit-user-select: none;
          }
        `
      }} />
    </div>
  );
}