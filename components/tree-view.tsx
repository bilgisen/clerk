"use client";

import * as React from "react";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Folder,
  ChevronRight,
  ChevronDown,
  Box,
  Search,
  Info,
  X,
  Share2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/** dnd-kit */
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

export interface TreeViewItem {
  id: string;
  name: string;
  type: string;
  children?: TreeViewItem[];
  checked?: boolean;
}

export interface TreeViewIconMap {
  [key: string]: ReactNode | undefined;
}

export interface TreeViewMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  action: (items: TreeViewItem[]) => void;
}

export interface TreeViewProps {
  className?: string;
  data: TreeViewItem[];
  title?: string;
  showExpandAll?: boolean;
  showCheckboxes?: boolean;
  checkboxPosition?: "left" | "right";
  searchPlaceholder?: string;
  selectionText?: string;
  checkboxLabels?: {
    check: string;
    uncheck: string;
  };
  getIcon?: (item: TreeViewItem, depth: number) => ReactNode;
  onSelectionChange?: (selectedItems: TreeViewItem[]) => void;
  onAction?: (action: string, items: TreeViewItem[]) => void;
  onCheckChange?: (item: TreeViewItem, checked: boolean) => void;
  iconMap?: TreeViewIconMap;
  menuItems?: TreeViewMenuItem[];

  /** DnD: item taşındığında tetiklenir */
  onMoveItem?: (
    item: TreeViewItem,
    newParentId: string | null,
    newIndex: number
  ) => void;

  /** Ağaç her değiştiğinde (drag-drop sonrası) tüm ağaç döner */
  onTreeChange?: (newTree: TreeViewItem[]) => void;
}

interface TreeItemProps {
  item: TreeViewItem;
  depth?: number;
  selectedIds: Set<string>;
  lastSelectedId: React.MutableRefObject<string | null>;
  onSelect: (ids: Set<string>) => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string, isOpen: boolean) => void;
  getIcon?: (item: TreeViewItem, depth: number) => ReactNode;
  onAction?: (action: string, items: TreeViewItem[]) => void;
  onAccessChange?: (item: TreeViewItem, hasAccess: boolean) => void;
  allItems: TreeViewItem[];
  showAccessRights?: boolean;
  itemMap: Map<string, TreeViewItem>;
  iconMap?: TreeViewIconMap;
  menuItems?: TreeViewMenuItem[];
  getSelectedItems: () => TreeViewItem[];

  /** DnD helpers */
  parentId: string | null;
}

/** ---- helpers ---- */

const buildItemMap = (items: TreeViewItem[]): Map<string, TreeViewItem> => {
  const map = new Map<string, TreeViewItem>();
  const processItem = (item: TreeViewItem) => {
    map.set(item.id, item);
    item.children?.forEach(processItem);
  };
  items.forEach(processItem);
  return map;
};

const buildParentMap = (
  items: TreeViewItem[],
  parentId: string | null = null,
  parentMap: Map<string, string | null> = new Map()
) => {
  items.forEach((it) => {
    parentMap.set(it.id, parentId);
    if (it.children?.length) buildParentMap(it.children, it.id, parentMap);
  });
  return parentMap;
};

const getCheckState = (
  item: TreeViewItem,
  itemMap: Map<string, TreeViewItem>
): "checked" | "unchecked" | "indeterminate" => {
  const originalItem = itemMap.get(item.id);
  if (!originalItem) return "unchecked";
  if (!originalItem.children || originalItem.children.length === 0) {
    return originalItem.checked ? "checked" : "unchecked";
  }
  let checkedCount = 0;
  let indeterminateCount = 0;
  originalItem.children.forEach((child) => {
    const childState = getCheckState(child, itemMap);
    if (childState === "checked") checkedCount++;
    if (childState === "indeterminate") indeterminateCount++;
  });

  const totalChildren = originalItem.children.length;
  if (checkedCount === totalChildren) return "checked";
  if (checkedCount > 0 || indeterminateCount > 0) return "indeterminate";
  return "unchecked";
};

const defaultIconMap: TreeViewIconMap = {
  file: <Box className="h-4 w-4 text-red-600" />,
  folder: <Folder className="h-4 w-4 text-primary/80" />,
  chapter: <Folder className="h-4 w-4 text-primary/80" />,
};

/** ağacı immutably taşı: itemId -> (newParentId, newIndex) */
function moveInTree(
  tree: TreeViewItem[],
  itemId: string,
  newParentId: string | null,
  newIndex: number
): TreeViewItem[] {
  const clone = structuredClone(tree) as TreeViewItem[];

  // node'u ve ebeveynini bul, çıkar
  let targetNode: TreeViewItem | null = null;

  const removeFromParent = (
    items: TreeViewItem[],
    parent: TreeViewItem | null
  ): boolean => {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.id === itemId) {
        targetNode = it;
        items.splice(i, 1);
        return true;
      }
      if (it.children && removeFromParent(it.children, it)) return true;
    }
    return false;
  };

  removeFromParent(clone, null);
  if (!targetNode) return clone;

  // yeni ebeveyni bul, ilgili yere yerleştir
  const insertTo = (items: TreeViewItem[], parentId: string | null) => {
    if (parentId === null) {
      const idx = Math.min(Math.max(newIndex, 0), items.length);
      items.splice(idx, 0, targetNode!);
      return true;
    }
    for (const it of items) {
      if (it.id === parentId) {
        if (!it.children) it.children = [];
        const idx = Math.min(Math.max(newIndex, 0), it.children.length);
        it.children.splice(idx, 0, targetNode!);
        return true;
      }
      if (it.children && insertTo(it.children, parentId)) return true;
    }
    return false;
  };

  insertTo(clone, newParentId);
  return clone;
}

/** görünür (expand edilmiş) düz liste */
function flattenVisible(
  items: TreeViewItem[],
  expandedIds: Set<string>,
  parentId: string | null = null,
  depth = 0,
  acc: Array<{
    item: TreeViewItem;
    parentId: string | null;
    depth: number;
    indexWithinParent: number;
  }> = []
) {
  items.forEach((it, idx) => {
    acc.push({ item: it, parentId, depth, indexWithinParent: idx });
    if (it.children?.length && expandedIds.has(it.id)) {
      flattenVisible(it.children, expandedIds, it.id, depth + 1, acc);
    }
  });
  return acc;
}

/** ---- TreeItem (tek satır) ---- */

function TreeItem({
  item,
  depth = 0,
  selectedIds,
  lastSelectedId,
  onSelect,
  expandedIds,
  onToggleExpand,
  getIcon,
  onAction,
  onAccessChange,
  allItems,
  showAccessRights,
  itemMap,
  iconMap = defaultIconMap,
  menuItems,
  getSelectedItems,
  parentId,
}: TreeItemProps): React.JSX.Element {
  const isOpen = expandedIds.has(item.id);
  const isSelected = selectedIds.has(item.id);
  const itemRef = useRef<HTMLDivElement>(null);
  const [selectionStyle, setSelectionStyle] = useState("");

  /** dnd refs */
  const {
    setNodeRef: setDropRef,
    isOver,
  } = useDroppable({ id: item.id });

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({ id: item.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  // görünür bloklar arası yuvarlatma
  const getVisibleItems = useCallback(
    (items: TreeViewItem[]): TreeViewItem[] => {
      let visibleItems: TreeViewItem[] = [];
      items.forEach((i) => {
        visibleItems.push(i);
        if (i.children && expandedIds.has(i.id)) {
          visibleItems = [...visibleItems, ...getVisibleItems(i.children)];
        }
      });
      return visibleItems;
    },
    [expandedIds]
  );

  useEffect(() => {
    if (!isSelected) {
      setSelectionStyle("");
      return;
    }
    const visibleItems = getVisibleItems(allItems);
    const currentIndex = visibleItems.findIndex((i) => i.id === item.id);
    const prevItem = visibleItems[currentIndex - 1];
    const nextItem = visibleItems[currentIndex + 1];
    const isPrevSelected = prevItem && selectedIds.has(prevItem.id);
    const isNextSelected = nextItem && selectedIds.has(nextItem.id);
    const roundTop = !isPrevSelected;
    const roundBottom = !isNextSelected;
    setSelectionStyle(
      `${roundTop ? "rounded-t-md" : ""} ${roundBottom ? "rounded-b-md" : ""}`
    );
  }, [isSelected, selectedIds, expandedIds, item.id, getVisibleItems, allItems]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    let newSelection = new Set(selectedIds);
    if (!itemRef.current) return;

    if (e.shiftKey && lastSelectedId.current !== null) {
      const items = Array.from(
        document.querySelectorAll("[data-tree-item]")
      ) as HTMLElement[];
      const lastIndex = items.findIndex(
        (el) => el.getAttribute("data-id") === lastSelectedId.current
      );
      const currentIndex = items.findIndex((el) => el === itemRef.current);
      const [start, end] = [
        Math.min(lastIndex, currentIndex),
        Math.max(lastIndex, currentIndex),
      ];
      items.slice(start, end + 1).forEach((el) => {
        const id = el.getAttribute("data-id");
        const parentFolderClosed = el.closest('[data-folder-closed="true"]');
        const isClosedFolder = el.getAttribute("data-folder-closed") === "true";
        if (id && (isClosedFolder || !parentFolderClosed)) {
          newSelection.add(id);
        }
      });
    } else if (e.ctrlKey || e.metaKey) {
      if (newSelection.has(item.id)) newSelection.delete(item.id);
      else newSelection.add(item.id);
    } else {
      newSelection = new Set([item.id]);
      // tek tıkta klasör aç/kapa
      if (item.children && isSelected) {
        onToggleExpand(item.id, !isOpen);
      }
    }

    lastSelectedId.current = item.id;
    onSelect(newSelection);
  };

  const handleAction = (action: string) => {
    if (onAction) {
      const selectedItems =
        selectedIds.size > 0
          ? allItems
              .flatMap((i) => getAllDescendants(i))
              .filter((i) => selectedIds.has(i.id))
          : [item];
      onAction(action, selectedItems);
    }
  };

  const getAllDescendants = (i: TreeViewItem): TreeViewItem[] => {
    const d = [i];
    if (i.children) i.children.forEach((c) => d.push(...getAllDescendants(c)));
    return d;
  };

  const handleAccessClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAccessChange) {
      const currentState = getCheckState(item, itemMap);
      const newChecked = currentState === "checked" ? false : true;
      onAccessChange(item, newChecked);
    }
  };

  const renderIcon = () => {
    if (getIcon) return getIcon(item, depth);
    return iconMap[item.type] || iconMap.folder || defaultIconMap.folder;
  };

  const getItemPath = (i: TreeViewItem, items: TreeViewItem[]): string => {
    const path: string[] = [i.name];
    const findParent = (curr: TreeViewItem, all: TreeViewItem[]) => {
      for (const p of all) {
        if (p.children?.some((c) => c.id === curr.id)) {
          path.unshift(p.name);
          findParent(p, all);
          break;
        }
        if (p.children) findParent(curr, p.children);
      }
    };
    findParent(i, items);
    return path.join(" → ");
  };

  const getSelectedChildrenCount = (i: TreeViewItem): number => {
    let count = 0;
    if (!i.children) return 0;
    i.children.forEach((child) => {
      if (selectedIds.has(child.id)) count++;
      if (child.children) count += getSelectedChildrenCount(child);
    });
    return count;
  };

  const selectedCount =
    (item.children && !isOpen && getSelectedChildrenCount(item)) || null;

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div ref={(node) => { itemRef.current = node; setDropRef(node as any); }}>
          <div
            ref={setDragRef as any}
            {...attributes}
            {...listeners}
            data-tree-item
            data-id={item.id}
            data-depth={depth}
            data-folder-closed={item.children && !isOpen}
            className={cn(
              "select-none cursor-pointer px-1",
              isSelected ? `bg-orange-100 ${selectionStyle}` : "text-foreground",
              isOver && "ring-2 ring-primary/40"
            )}
            style={{ paddingLeft: `${depth * 20}px`, ...style }}
            onClick={handleClick}
          >
            <div className="flex items-center h-8">
              {item.children ? (
                <div className="flex items-center gap-2 flex-1 group">
                  <Collapsible
                    open={isOpen}
                    onOpenChange={(open) => onToggleExpand(item.id, open)}
                  >
                    <CollapsibleTrigger
                      asChild
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <motion.div
                          initial={false}
                          animate={{ rotate: isOpen ? 90 : 0 }}
                          transition={{ duration: 0.1 }}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </motion.div>
                      </Button>
                    </CollapsibleTrigger>
                  </Collapsible>
                  {/* checkbox (opsiyonel) */}
                  {showAccessRights && (
                    <div
                      className="relative flex items-center justify-center w-4 h-4 cursor-pointer hover:opacity-80"
                      onClick={handleAccessClick}
                    >
                      {getCheckState(item, itemMap) === "checked" && (
                        <div className="w-4 h-4 border rounded bg-primary border-primary flex items-center justify-center">
                          <svg
                            className="h-3 w-3 text-primary-foreground"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      )}
                      {getCheckState(item, itemMap) === "unchecked" && (
                        <div className="w-4 h-4 border rounded border-input" />
                      )}
                      {getCheckState(item, itemMap) === "indeterminate" && (
                        <div className="w-4 h-4 border rounded bg-primary border-primary flex items-center justify-center">
                          <div className="h-0.5 w-2 bg-primary-foreground" />
                        </div>
                      )}
                    </div>
                  )}
                  {renderIcon()}
                  <span className="flex-1">{item.name}</span>
                  {selectedCount !== null && selectedCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="mr-2 bg-blue-100 hover:bg-blue-100"
                    >
                      {selectedCount} selected
                    </Badge>
                  )}
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 group-hover:opacity-100 opacity-0 items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80">
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold">{item.name}</h4>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div>
                            <span className="font-medium">Type:</span>{" "}
                            {item.type.charAt(0).toUpperCase() +
                              item.type.slice(1).replace("_", " ")}
                          </div>
                          <div>
                            <span className="font-medium">ID:</span> {item.id}
                          </div>
                          <div>
                            <span className="font-medium">Location:</span>{" "}
                            {getItemPath(item, allItems)}
                          </div>
                          <div>
                            <span className="font-medium">Items:</span>{" "}
                            {item.children?.length || 0} direct items
                          </div>
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1 pl-8 group">
                  {showAccessRights && (
                    <div
                      className="relative flex items-center justify-center w-4 h-4 cursor-pointer hover:opacity-80"
                      onClick={handleAccessClick}
                    >
                      {item.checked ? (
                        <div className="w-4 h-4 border rounded bg-primary border-primary flex items-center justify-center">
                          <svg
                            className="h-3 w-3 text-primary-foreground"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-4 h-4 border rounded border-input" />
                      )}
                    </div>
                  )}
                  {renderIcon()}
                  <span className="flex-1">{item.name}</span>
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 group-hover:opacity-100 opacity-0 items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80">
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold">{item.name}</h4>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div>
                            <span className="font-medium">Type:</span>{" "}
                            {item.type.charAt(0).toUpperCase() +
                              item.type.slice(1).replace("_", " ")}
                          </div>
                          <div>
                            <span className="font-medium">ID:</span> {item.id}
                          </div>
                          <div>
                            <span className="font-medium">Location:</span>{" "}
                            {getItemPath(item, allItems)}
                          </div>
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </div>
              )}
            </div>
          </div>

          {item.children && (
            <Collapsible
              open={isOpen}
              onOpenChange={(open) => onToggleExpand(item.id, open)}
            >
              <AnimatePresence initial={false}>
                {isOpen && (
                  <CollapsibleContent forceMount asChild>
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.05 }}
                    >
                      {item.children?.map((child) => (
                        <TreeItem
                          key={child.id}
                          item={child}
                          depth={depth + 1}
                          selectedIds={selectedIds}
                          lastSelectedId={lastSelectedId}
                          onSelect={onSelect}
                          expandedIds={expandedIds}
                          onToggleExpand={onToggleExpand}
                          getIcon={getIcon}
                          onAction={onAction}
                          onAccessChange={onAccessChange}
                          allItems={allItems}
                          showAccessRights={showAccessRights}
                          itemMap={itemMap}
                          iconMap={iconMap}
                          menuItems={menuItems}
                          getSelectedItems={getSelectedItems}
                          parentId={item.id}
                        />
                      ))}
                    </motion.div>
                  </CollapsibleContent>
                )}
              </AnimatePresence>
            </Collapsible>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        {menuItems?.map((menuItem) => (
          <ContextMenuItem
            key={menuItem.id}
            onClick={() => {
              const items = selectedIds.has(item.id)
                ? getSelectedItems()
                : [item];
              menuItem.action(items);
            }}
          >
            {menuItem.icon && (
              <span className="mr-2 h-4 w-4">{menuItem.icon}</span>
            )}
            {menuItem.label}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** ---- Ana TreeView ---- */

export default function TreeView({
  className,
  checkboxLabels = { check: "Check", uncheck: "Uncheck" },
  data,
  iconMap,
  searchPlaceholder = "Search...",
  selectionText = "selected",
  showExpandAll = true,
  showCheckboxes = false,
  getIcon,
  onSelectionChange,
  onAction,
  onCheckChange,
  menuItems,
  onMoveItem,
  onTreeChange,
}: TreeViewProps) {
  /** ✅ tree state (drag-drop sonrası biz güncelliyoruz) */
  const [tree, setTree] = useState<TreeViewItem[]>(data);

  useEffect(() => {
    setTree(data);
  }, [data]);

  const [currentMousePos, setCurrentMousePos] = useState<number>(0);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragStartPosition, setDragStartPosition] = useState<{ x: number; y: number } | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const dragRef = useRef<HTMLDivElement>(null);
  const lastSelectedId = useRef<string | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);

  const itemMap = useMemo(() => buildItemMap(tree), [tree]);
  const parentMap = useMemo(() => buildParentMap(tree), [tree]);

  /** dnd-kit sensors */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  /** arama filtresi */
  const { filteredData, searchExpandedIds } = useMemo(() => {
    if (!searchQuery.trim()) {
      return { filteredData: tree, searchExpandedIds: new Set<string>() };
    }
    const searchLower = searchQuery.toLowerCase();
    const newExpandedIds = new Set<string>();

    const itemMatches = (item: TreeViewItem): boolean => {
      const nameMatches = item.name.toLowerCase().includes(searchLower);
      if (nameMatches) return true;
      if (item.children) return item.children.some((child) => itemMatches(child));
      return false;
    };

    const filterTree = (items: TreeViewItem[]): TreeViewItem[] => {
      return items
        .map((item) => {
          if (!item.children) {
            return itemMatches(item) ? item : null;
          }
          const filteredChildren = filterTree(item.children);
          if (filteredChildren.length > 0 || itemMatches(item)) {
            if (item.children) newExpandedIds.add(item.id);
            return { ...item, children: filteredChildren };
          }
          return null;
        })
        .filter((i): i is TreeViewItem => i !== null);
    };

    return { filteredData: filterTree(tree), searchExpandedIds: newExpandedIds };
  }, [tree, searchQuery]);

  useEffect(() => {
    if (searchQuery.trim()) {
      setExpandedIds((prev) => new Set([...prev, ...searchExpandedIds]));
    }
  }, [searchExpandedIds, searchQuery]);

  /** dışarı tıklayınca seçim temizle */
  useEffect(() => {
    const handleClickAway = (e: MouseEvent) => {
      const target = e.target as Element;
      const clickedInside =
        (treeRef.current && treeRef.current.contains(target)) ||
        (dragRef.current && dragRef.current.contains(target)) ||
        target.closest('[role="menu"]') ||
        target.closest("[data-radix-popper-content-wrapper]");
      if (!clickedInside) {
        setSelectedIds(new Set());
        lastSelectedId.current = null;
      }
    };
    document.addEventListener("mousedown", handleClickAway);
    return () => document.removeEventListener("mousedown", handleClickAway);
  }, []);

  const getAllFolderIds = (items: TreeViewItem[]): string[] => {
    let ids: string[] = [];
    items.forEach((item) => {
      if (item.children) {
        ids.push(item.id);
        ids = [...ids, ...getAllFolderIds(item.children)];
      }
    });
    return ids;
  };

  const handleExpandAll = () => setExpandedIds(new Set(getAllFolderIds(tree)));
  const handleCollapseAll = () => setExpandedIds(new Set());

  const handleToggleExpand = (id: string, isOpen: boolean) => {
    const newExpandedIds = new Set(expandedIds);
    if (isOpen) newExpandedIds.add(id);
    else newExpandedIds.delete(id);
    setExpandedIds(newExpandedIds);
  };

  const getSelectedItems = useCallback((): TreeViewItem[] => {
    const items: TreeViewItem[] = [];
    const processItem = (item: TreeViewItem) => {
      if (selectedIds.has(item.id)) items.push(item);
      item.children?.forEach(processItem);
    };
    tree.forEach(processItem);
    return items;
  }, [selectedIds, tree]);

  const getEffectiveSelectedItems = useCallback((): TreeViewItem[] => {
    const selectedItems = getSelectedItems();
    const selectedIdsSet = new Set(selectedItems.map((i) => i.id));
    return selectedItems.filter((i) => {
      if (!i.children) return true;
      const hasSelectedChildren = i.children.some((c) => selectedIdsSet.has(c.id));
      return !hasSelectedChildren;
    });
  }, [getSelectedItems]);

  /** eski “drag to select” (fare ile alan çizme) aynen korundu */
  const DRAG_THRESHOLD = 10;
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    setDragStartPosition({ x: e.clientX, y: e.clientY });
  }, []);
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!(e.buttons & 1)) {
        setIsDragging(false);
        setDragStart(null);
        setDragStartPosition(null);
        return;
      }
      if (!dragStartPosition) return;

      const deltaX = e.clientX - dragStartPosition.x;
      const deltaY = e.clientY - dragStartPosition.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (!isDragging) {
        if (distance > DRAG_THRESHOLD) {
          setIsDragging(true);
          setDragStart(dragStartPosition.y);
          if (!e.shiftKey && !e.ctrlKey) {
            setSelectedIds(new Set());
            lastSelectedId.current = null;
          }
        }
        return;
      }

      if (!dragRef.current) return;
      const items = Array.from(
        dragRef.current.querySelectorAll("[data-tree-item]")
      ) as HTMLElement[];

      const startY = dragStart;
      const currentY = e.clientY;
      const [selectionStart, selectionEnd] = [
        Math.min(startY || 0, currentY),
        Math.max(startY || 0, currentY),
      ];

      const newSelection = new Set(
        e.shiftKey || e.ctrlKey ? Array.from(selectedIds) : []
      );

      items.forEach((item) => {
        const rect = item.getBoundingClientRect();
        const itemTop = rect.top;
        const itemBottom = rect.top + rect.height;
        if (itemBottom >= selectionStart && itemTop <= selectionEnd) {
          const id = item.getAttribute("data-id");
          const isClosedFolder =
            item.getAttribute("data-folder-closed") === "true";
          const parentFolderClosed = item.closest('[data-folder-closed="true"]');
          if (id && (isClosedFolder || !parentFolderClosed)) newSelection.add(id);
        }
      });

      setSelectedIds(newSelection);
      setCurrentMousePos(e.clientY);
    },
    [isDragging, dragStart, selectedIds, dragStartPosition]
  );
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
    setDragStartPosition(null);
  }, []);
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("mouseleave", handleMouseUp);
    }
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mouseleave", handleMouseUp);
    };
  }, [isDragging, handleMouseUp]);

  useEffect(() => {
    onSelectionChange?.(getSelectedItems());
  }, [selectedIds, onSelectionChange, getSelectedItems]);

  /** ---- dnd-kit olayları ---- */

  const visibleFlat = useMemo(
    () => flattenVisible(tree, expandedIds),
    [tree, expandedIds]
  );

  const handleDragStart = (_e: DragStartEvent) => {
    // noop, ama istersen highlight yapabilirsin
  };

  const handleDragOver = (_e: DragOverEvent) => {
    // noop
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const overEntry = visibleFlat.find((v) => v.item.id === overId);
    const activeEntry = visibleFlat.find((v) => v.item.id === activeId);
    if (!overEntry || !activeEntry) return;

    const overItem = overEntry.item;

    let nextParentId: string | null;
    let nextIndex: number;

    // ✅ Klasör üstüne bırakınca içine at (reparent)
    if (overItem.children && overItem.children.length >= 0) {
      nextParentId = overItem.id;
      nextIndex = overItem.children?.length ?? 0; // klasörün sonuna
      // istersen hep başa koy: nextIndex = 0;
      setExpandedIds((prev) => new Set([...prev, overItem.id]));
    } else {
      // ✅ Yoksa hedefin ebeveyninde, hedeften HEMEN SONRA sırala
      nextParentId = parentMap.get(overId) ?? null;
      nextIndex = overEntry.indexWithinParent + 1;
    }

    const newTree = moveInTree(tree, activeId, nextParentId, nextIndex);
    setTree(newTree);
    onTreeChange?.(newTree);

    const movedItem = itemMap.get(activeId);
    if (movedItem) onMoveItem?.(movedItem, nextParentId, nextIndex);
  };

  return (
    <div className="flex gap-4">
      <div
        ref={treeRef}
        className="bg-background p-6 rounded-xl border max-w-2xl space-y-4 w-[600px] relative shadow-lg"
      >
        <AnimatePresence mode="wait">
          {selectedIds.size > 0 ? (
            <motion.div
              key="selection"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-10 flex items-center justify-between bg-background rounded-lg border px-4"
            >
              <div
                className="font-medium cursor-pointer flex items-center"
                title="Clear selection"
                onClick={() => {
                  setSelectedIds(new Set());
                  lastSelectedId.current = null;
                }}
              >
                <X className="h-4 w-4 mr-2" />
                {selectedIds.size} {selectionText}
              </div>

              {showCheckboxes && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const effectiveItems = getEffectiveSelectedItems();
                      const processItem = (item: TreeViewItem) => {
                        onCheckChange?.(item, true);
                        item.children?.forEach(processItem);
                      };
                      effectiveItems.forEach(processItem);
                    }}
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  >
                    {checkboxLabels.check}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const effectiveItems = getEffectiveSelectedItems();
                      const processItem = (item: TreeViewItem) => {
                        onCheckChange?.(item, false);
                        item.children?.forEach(processItem);
                      };
                      effectiveItems.forEach(processItem);
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {checkboxLabels.uncheck}
                  </Button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="h-10 flex items-center gap-2"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 pl-9"
                />
              </div>
              {showExpandAll && (
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 px-2"
                    onClick={handleExpandAll}
                  >
                    <ChevronDown className="h-4 w-4 mr-1" />
                    Expand All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 px-2"
                    onClick={handleCollapseAll}
                  >
                    <ChevronRight className="h-4 w-4 mr-1" />
                    Collapse All
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div
            ref={dragRef}
            className={cn("rounded-lg bg-card relative select-none", className)}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
          >
            {isDragging && (
              <div
                className="absolute inset-0 bg-blue-500/0 pointer-events-none"
                style={{
                  top: Math.min(
                    dragStart || 0,
                    dragStart === null ? 0 : currentMousePos
                  ),
                  height: Math.abs(
                    (dragStart || 0) - (dragStart === null ? 0 : currentMousePos)
                  ),
                }}
              />
            )}

            {filteredData.map((item) => (
              <TreeItem
                key={item.id}
                item={item}
                selectedIds={selectedIds}
                lastSelectedId={lastSelectedId}
                onSelect={setSelectedIds}
                expandedIds={expandedIds}
                onToggleExpand={handleToggleExpand}
                getIcon={getIcon}
                onAction={onAction}
                onAccessChange={onCheckChange}
                allItems={tree}
                showAccessRights={showCheckboxes}
                itemMap={itemMap}
                iconMap={iconMap}
                menuItems={menuItems}
                getSelectedItems={getSelectedItems}
                parentId={null}
              />
            ))}
          </div>
        </DndContext>
      </div>
    </div>
  );
}
