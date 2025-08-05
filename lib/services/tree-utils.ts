// lib/utils/tree-utils.ts
import type { ChapterNode } from '@/types/dnd';

export function buildTree(flat: ChapterNode[]): ChapterNode[] {
  const map = new Map<string, ChapterNode>();
  const roots: ChapterNode[] = [];

  flat.forEach(item => {
    map.set(item.id, { ...item, children: [] });
  });

  map.forEach(item => {
    if (item.parent_chapter_id) {
      const parent = map.get(item.parent_chapter_id);
      if (parent) {
        parent.children!.push(item);
      }
    } else {
      roots.push(item);
    }
  });

  return roots;
}

export function flattenTree(tree: ChapterNode[], parentId: string | null = null): ChapterNode[] {
  let result: ChapterNode[] = [];

  tree.forEach((node, index) => {
    const { children, ...rest } = node;
    result.push({
      ...rest,
      parent_chapter_id: parentId,
      order: index,
    });

    if (children && children.length > 0) {
      result = result.concat(flattenTree(children, node.id));
    }
  });

  return result;
}

export function moveItemToNewParentAndReorder(
  items: ChapterNode[],
  draggedId: string,
  newParentId: string | null,
  newIndex: number
): ChapterNode[] {
  let updatedItems = items.map(item =>
    item.id === draggedId ? { ...item, parent_chapter_id: newParentId } : item,
  );

  const siblings = updatedItems
    .filter(item => item.parent_chapter_id === newParentId && item.id !== draggedId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  siblings.splice(newIndex, 0, updatedItems.find(i => i.id === draggedId)!);

  const reorderedSiblings = siblings.map((item, index) => ({
    ...item,
    order: index,
  }));

  updatedItems = updatedItems.map(item => {
    const updated = reorderedSiblings.find(i => i.id === item.id);
    return updated ?? item;
  });

  return updatedItems;
}