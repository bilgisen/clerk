// lib/tree-utils.ts
export type ChapterNode = {
  id: string;
  title: string;
  parentId: string | null;
  order: number;
  level: number;
};

/**
 * Bir item'ı yeni parent altına taşı ve tüm order/level değerlerini normalize et
 */
export function moveItemToNewParentAndReorder(
  flat: ChapterNode[],
  itemId: string,
  newParentId: string | null,
  newIndex: number
): ChapterNode[] {
  let updated = [...flat];

  // Item bul
  const item = updated.find((ch) => ch.id === itemId);
  if (!item) return updated;

  // Eski yerinden çıkar
  updated = updated.filter((ch) => ch.id !== itemId);

  // Parent güncelle
  item.parentId = newParentId;

  // Yeni parent'ın siblings listesi
  const siblings = updated.filter((ch) => ch.parentId === newParentId);

  // Yeni index'e ekle
  siblings.splice(newIndex, 0, item);

  // Siblings order normalize
  siblings.forEach((s, idx) => {
    s.order = idx;
  });

  // Level’ları recursive hesapla
  const recalcLevels = (nodes: ChapterNode[], parentId: string | null, level: number) => {
    nodes
      .filter((n) => n.parentId === parentId)
      .sort((a, b) => a.order - b.order)
      .forEach((n, idx) => {
        n.order = idx;
        n.level = level;
        recalcLevels(nodes, n.id, level + 1);
      });
  };

  recalcLevels(updated, null, 0);

  return updated;
}
