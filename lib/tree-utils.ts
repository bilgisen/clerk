// lib/tree-utils.ts
import type { Chapter, ChapterNode } from '@/types/chapters';

// Extend ChapterNode to include both possible parent ID field names
type EnhancedChapterNode = ChapterNode & {
  parentChapterId?: string | null;
  parent_chapter_id?: string | null;
  children?: EnhancedChapterNode[];
};

export type FlatItem = EnhancedChapterNode & { index: number };

/**
 * Gets the parent ID from a chapter, handling both field names
 */
function getParentId(chapter: EnhancedChapterNode): string | null {
  return chapter.parentChapterId ?? chapter.parent_chapter_id ?? null;
}

export function sortByOrder(a: { order: number }, b: { order: number }): number {
  return (a.order || 0) - (b.order || 0);
}

/**
 * Builds a map of parent IDs to their children
 */
export function buildChildrenMap(items: EnhancedChapterNode[]): Map<string | null, EnhancedChapterNode[]> {
  const map = new Map<string | null, EnhancedChapterNode[]>();
  
  for (const item of items) {
    const key = getParentId(item);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(item);
  }
  
  // Sort each group of children by order
  for (const children of map.values()) {
    children.sort(sortByOrder);
  }
  
  return map;
}

/**
 * Flattens a tree structure into a flat array with indices
 */
export function flattenTree(items: EnhancedChapterNode[]): FlatItem[] {
  const result: FlatItem[] = [];
  const byParent = buildChildrenMap(items);
  
  function walk(parentId: string | null, level = 0) {
    const children = byParent.get(parentId) || [];
    children.forEach((child, index) => {
      result.push({ ...child, index });
      walk(child.id, level + 1);
    });
  }
  
  walk(null);
  return result;
}

/**
 * Gets all descendants of a parent chapter as a flat array
 */
export function getFlatChildren(parentId: string | null, items: EnhancedChapterNode[]): EnhancedChapterNode[] {
  const result: EnhancedChapterNode[] = [];
  const children = items.filter(item => getParentId(item) === parentId);
  
  for (const child of children) {
    result.push(child);
    result.push(...getFlatChildren(child.id, items));
  }
  
  return result;
}

/**
 * Calculates the next order value for a new chapter
 */
export function getNewOrder(items: EnhancedChapterNode[], parentId: string | null): number {
  const siblings = items.filter(item => getParentId(item) === parentId);
  if (siblings.length === 0) return 1000;
  return Math.max(...siblings.map(s => s.order || 0)) + 1000;
}

/**
 * Calculates the depth of a chapter in the tree
 */
export function getParentDepth(items: EnhancedChapterNode[], id: string, currentDepth = 0): number {
  const item = items.find(i => i.id === id);
  if (!item) return currentDepth;
  
  const parentId = getParentId(item);
  if (!parentId) return currentDepth;
  
  return getParentDepth(items, parentId, currentDepth + 1);
}

/**
 * Finds the maximum depth in the chapter tree
 */
export function getMaxDepth(items: EnhancedChapterNode[]): number {
  let maxDepth = 0;
  
  items.forEach(item => {
    const depth = getParentDepth(items, item.id);
    if (depth > maxDepth) maxDepth = depth;
  });
  
  return maxDepth;
}

/**
 * Converts a hierarchical chapter structure to a flat array
 */
export function flattenChapterTree(chapters: EnhancedChapterNode[]): EnhancedChapterNode[] {
  const result: EnhancedChapterNode[] = [];
  
  function walk(nodes: EnhancedChapterNode[]) {
    nodes.forEach(node => {
      const { children, ...rest } = node;
      result.push(rest);
      if (children && children.length > 0) {
        walk(children);
      }
    });
  }
  
  walk(chapters);
  return result;
}
