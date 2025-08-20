// lib/tree-utils.ts
import type { ChapterNode } from '@/types/chapters';

export type FlatItem = ChapterNode & { index: number };

export function sortByOrder(a: ChapterNode, b: ChapterNode) {
  return a.order - b.order;
}

export function buildChildrenMap(items: ChapterNode[]) {
  const map = new Map<string | null, ChapterNode[]>();
  for (const it of items) {
    const key = it.parent_chapter_id ?? null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(it);
  }
  for (const arr of map.values()) arr.sort(sortByOrder);
  return map;
}

export function flattenTree(items: ChapterNode[]): FlatItem[] {
  const byParent = buildChildrenMap(items);
  const result: FlatItem[] = [];
  
  function walk(parent: string | null, level = 1) {
    const children = byParent.get(parent) || [];
    children.forEach((child, index) => {
      result.push({ ...child, index });
      walk(child.id, level + 1);
    });
  }
  
  walk(null);
  return result;
}

export function getFlatChildren(parentId: string | null, items: ChapterNode[]): ChapterNode[] {
  const result: ChapterNode[] = [];
  const children = items.filter(item => item.parent_chapter_id === parentId);
  
  for (const child of children) {
    result.push(child);
    result.push(...getFlatChildren(child.id, items));
  }
  
  return result;
}

export function getNewOrder(items: ChapterNode[], parentId: string | null): number {
  const siblings = items.filter(item => item.parent_chapter_id === parentId);
  if (siblings.length === 0) return 1000;
  return Math.max(...siblings.map(s => s.order)) + 1000;
}

export function getParentDepth(items: ChapterNode[], id: string): number {
  const item = items.find(i => i.id === id);
  if (!item || !item.parent_chapter_id) return 0;
  return 1 + getParentDepth(items, item.parent_chapter_id);
}

export function getMaxDepth(items: ChapterNode[]): number {
  let maxDepth = 0;
  items.forEach(item => {
    const depth = getParentDepth(items, item.id);
    if (depth > maxDepth) maxDepth = depth;
  });
  return maxDepth;
}
