// lib/convert-chapters.ts
import { TreeViewItem } from "@/components/tree-view";
import { Chapter } from "@/types/chapter";
import { ChapterOrderUpdate } from "@/types/dnd";

interface ChapterWithOrder extends Chapter {
  originalOrder?: number;
}

/**
 * Converts flat Chapter[] to nested TreeViewItem[] structure
 * with order-based sorting (root ve çocuklar).
 */
export function convertChaptersToTree(chapters: any[]): TreeViewItem[] {
  // Create lookup maps for O(1) access
  const nodeMap = new Map<string, TreeViewItem>();
  const childrenMap = new Map<string | null, TreeViewItem[]>();
  
  // First pass: create all nodes and build children map
  chapters.forEach((chapter) => {
    // Handle both parentChapterId (Drizzle) and parent_chapter_id (API) formats
    const parentId = chapter.parentChapterId || chapter.parent_chapter_id || null;
    const normalizedParentId = parentId ? String(parentId) : null;
    
    const node: TreeViewItem = {
      id: chapter.id,
      name: chapter.title,
      type: "chapter",
      children: [],
      data: {
        order: chapter.order ?? 0,
        level: chapter.level ?? 0,
        parent_chapter_id: normalizedParentId,
      },
    };
    
    nodeMap.set(chapter.id, node);
    
    // Handle parent-child relationships
    const parentKey = normalizedParentId;
    if (!childrenMap.has(parentKey)) {
      childrenMap.set(parentKey, []);
    }
    childrenMap.get(parentKey)!.push(node);
  });
  
  // Second pass: build the tree structure
  const buildTree = (parentId: string | null): TreeViewItem[] => {
    const nodes = childrenMap.get(parentId) || [];
    
    // Sort nodes by their order
    nodes.sort((a, b) => (a.data?.order ?? 0) - (b.data?.order ?? 0));
    
    // Build the tree recursively
    return nodes.map(node => ({
      ...node,
      children: buildTree(node.id)
    }));
  };
  
  // Start building from root nodes (parentId = null)
  return buildTree(null);
}

/** 
 * Converts the tree structure back to a flat list of ChapterOrderUpdate objects
 * with updated order and level based on the current tree structure
 */
export function buildOrderPayload(tree: TreeViewItem[], bookId: string): ChapterOrderUpdate[] {
  const payload: ChapterOrderUpdate[] = [];
  let orderCounter = 1000; // Start from 1000 and increment by 1000 for each item

  const walk = (items: TreeViewItem[], parentId: string | null, level: number) => {
    items.forEach((item) => {
      // Each item gets the current order counter value
      payload.push({
        id: item.id,
        bookId,
        parent_chapter_id: parentId,
        order: orderCounter,
        level,
      });
      
      orderCounter += 1000; // Increment for the next item
      
      // Recursively process children if they exist
      if (item.children?.length) {
        walk(item.children, item.id, level + 1);
      }
    });
  };

  walk(tree, null, 0);
  return payload;
}
