// lib/convert-chapters.ts
import { TreeViewItem } from "@/components/tree-view";
import { Chapter, ChapterWithChildren } from "@/types/chapter";
import { ChapterOrderUpdate } from "@/types/dnd";

type ChapterWithOrder = Chapter & {
  originalOrder?: number;
  children?: ChapterWithOrder[];
};

/**
 * Converts flat Chapter[] to nested TreeViewItem[] structure
 * with order-based sorting (root ve çocuklar).
 */
export function convertChaptersToTree(chapters: Chapter[] | ChapterWithChildren[]): TreeViewItem[] {
  // Handle both flat and hierarchical chapter structures
  const flatChapters = isChapterWithChildrenArray(chapters) 
    ? flattenChapterTree(chapters) 
    : chapters;

  // Create lookup maps for O(1) access
  const nodeMap = new Map<string, TreeViewItem>();
  const childrenMap = new Map<string | null, TreeViewItem[]>();
  
  // First pass: create all nodes and build children map
  flatChapters.forEach((chapter) => {
    // Use the correct property name from the database schema
    const parentId = chapter.parent_chapter_id || null;
    const normalizedParentId = parentId ? String(parentId) : null;
    
    const node: TreeViewItem = {
      id: chapter.id,
      name: chapter.title,
      children: [],
      order: chapter.order ?? 0,
      level: chapter.level ?? 0,
      parent_chapter_id: normalizedParentId,
      ...(chapter as any) // Spread any additional properties
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

// Helper function to check if the input is a hierarchical chapter structure
function isChapterWithChildrenArray(chapters: any[]): chapters is (Chapter & { children_chapters: any[] })[] {
  return chapters.length > 0 && 'children_chapters' in chapters[0];
}

// Helper function to flatten a hierarchical chapter structure
function flattenChapterTree(chapters: (Chapter & { children_chapters: any[] })[]): Chapter[] {
  const result: Chapter[] = [];
  
  function walk(nodes: (Chapter & { children_chapters: any[] })[]): void {
    nodes.forEach(node => {
      const { children_chapters, ...rest } = node;
      result.push(rest as Chapter);
      if (children_chapters && children_chapters.length > 0) {
        walk(children_chapters);
      }
    });
  }
  
  walk(chapters);
  return result;
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
