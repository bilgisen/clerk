import type { ChapterNode } from '@/types/dnd';
import { buildTree, flattenTree } from './tree-utils';

export type { ChapterNode };

/**
 * Calculates the level and order for each node in the tree
 * @param nodes Array of tree nodes
 * @returns Array of nodes with updated levels and orders
 */
export function calculateLevelsAndOrders(nodes: any[], parentLevel: number = 0, startOrder: number = 0): any[] {
  return nodes.map((node, index) => {
    const order = startOrder + index;
    const level = parentLevel;
    
    // Process children recursively if they exist
    const children = node.children 
      ? calculateLevelsAndOrders(node.children, level + 1, order * 100) 
      : [];
    
    return {
      ...node,
      level,
      order,
      ...(children.length > 0 && { children })
    };
  });
}

/**
 * Converts a tree structure to a flat array of chapters
 * @param tree Tree structure to convert
 * @param bookId ID of the book these chapters belong to
 * @returns Flat array of chapter nodes
 */
export function treeToChapters(tree: any[], bookId: string): ChapterNode[] {
  const flatNodes: ChapterNode[] = [];
  
  function processNode(node: any, parentId: string | null = null) {
    const { children, text, data, ...rest } = node;
    
    const chapter: ChapterNode = {
      id: node.id,
      title: text || data?.title || 'Untitled Chapter',
      slug: data?.slug,
      book_id: bookId,
      parent_chapter_id: parentId,
      order: node.order ?? 0,
      level: node.level ?? 0,
      created_at: data?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      isEditing: data?.isEditing ?? false,
      isExpanded: data?.isExpanded ?? true,
      ...(data || {})
    };
    
    // Remove any undefined values to avoid overriding with undefined
    Object.keys(chapter).forEach(key => {
      if (chapter[key as keyof ChapterNode] === undefined) {
        delete chapter[key as keyof ChapterNode];
      }
    });
    
    flatNodes.push(chapter);
    
    // Process children recursively
    if (children && children.length > 0) {
      children.forEach((child: any) => processNode(child, node.id));
    }
  }
  
  tree.forEach(node => processNode(node));
  return flatNodes;
}

/**
 * Sorts tree data by visual order (based on the order property)
 * @param treeData Tree data to sort
 * @returns Sorted tree data
 */
export function sortTreeDataByVisualOrder(treeData: any[]): any[] {
  if (!treeData || !treeData.length) return [];
  
  // Sort the current level
  const sorted = [...treeData].sort((a, b) => (a.order || 0) - (b.order || 0));
  
  // Recursively sort children
  return sorted.map(node => ({
    ...node,
    ...(node.children && {
      children: sortTreeDataByVisualOrder(node.children)
    })
  }));
}

// Re-export other utilities
export * from './tree-utils';
