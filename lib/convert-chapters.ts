import { TreeViewItem } from "@/components/tree-view";
import { ChapterNode as ApiChapterNode } from "@/types/dnd";

/**
 * Converts flat ApiChapterNode[] to nested TreeViewItem[] structure
 * with order-based sorting (root ve çocuklar).
 */
export function convertChaptersToTree(chapters: ApiChapterNode[]): TreeViewItem[] {
  const map = new Map<string, TreeViewItem>();

  // tüm nodeları hazırla
  chapters.forEach((ch) => {
    map.set(ch.id, {
      id: ch.id,
      name: ch.title,
      type: "chapter",
      children: [],
    });
  });

  // parent-child bağla
  const roots: TreeViewItem[] = [];
  chapters.forEach((ch) => {
    const node = map.get(ch.id)!;
    if (ch.parent_chapter_id) {
      map.get(ch.parent_chapter_id)?.children?.push(node);
    } else {
      roots.push(node);
    }
  });

  // recursive sort helper
  const sortTree = (items: TreeViewItem[], parentId: string | null = null) => {
    const siblings = parentId
      ? chapters.filter((ch) => ch.parent_chapter_id === parentId)
      : chapters.filter((ch) => !ch.parent_chapter_id);

    siblings.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const sorted: TreeViewItem[] = [];
    siblings.forEach((ch) => {
      const node = map.get(ch.id)!;
      node.children = sortTree(node.children ?? [], ch.id);
      sorted.push(node);
    });

    return sorted;
  };

  return sortTree(roots, null);
}

/** Ağacı (TreeViewItem[]) düz listeye indirip (id, parentId, order) üretir */
export function buildOrderPayload(tree: TreeViewItem[]) {
  const payload: Array<{ id: string; parent_chapter_id: string | null; order: number; level: number }> = [];

  const walk = (items: TreeViewItem[], parentId: string | null, level: number) => {
    items.forEach((it, idx) => {
      payload.push({
        id: it.id,
        parent_chapter_id: parentId,
        order: idx,
        level,
      });
      if (it.children?.length) walk(it.children, it.id, level + 1);
    });
  };

  walk(tree, null, 0);
  return payload;
}
