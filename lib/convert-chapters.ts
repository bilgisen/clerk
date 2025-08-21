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
export function convertChaptersToTree(chapters: Chapter[]): TreeViewItem[] {
  // Create lookup maps for O(1) access
  const nodeMap = new Map<string, TreeViewItem>();
  const childrenMap = new Map<string | null, TreeViewItem[]>();
  
  // First pass: create all nodes and build children map
  chapters.forEach((chapter) => {
    // Ensure parent_chapter_id is either a string or null
    const parentChapterId = chapter.parent_chapter_id ? String(chapter.parent_chapter_id) : null;
    
    const node: TreeViewItem = {
      id: chapter.id,
      name: chapter.title,
      type: "chapter",
      children: [],
      data: {
        order: chapter.order,
        level: chapter.level,
        parent_chapter_id: parentChapterId,
      },
    };
    
    nodeMap.set(chapter.id, node);
    
    // Handle parent-child relationships
    const parentId = parentChapterId;
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(node);
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
