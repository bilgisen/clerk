"use client";

import { useState, useCallback } from "react";
import SortableTree, { TreeItem } from "react-sortable-tree";
import "react-sortable-tree/style.css";

// Define the base TreeItem type that matches react-sortable-tree's expectations
interface BaseTreeItem extends TreeItem {
  title: string;
  children?: BaseTreeItem[];
  expanded?: boolean;
  isDirectory?: boolean;
  disableDrag?: boolean;
}

// Our custom ChapterNode type that extends the base TreeItem
export interface ChapterNode extends BaseTreeItem {
  id: string;
  title: string;
  children?: ChapterNode[];
  order: number;
  level: number;
  expanded: boolean;
  isDirectory: boolean;
  disableDrag: boolean;
  className?: string;
  subtitle?: string;
  book_id: string;
  parent_chapter_id: string | null;
  slug?: string;
  created_at?: string;
  updated_at?: string;
}

interface ChapterTreeWrapperProps {
  initialData: ChapterNode[];
  onReorder?: (updated: ChapterNode[]) => void;
}

export default function ChapterTreeWrapper({
  initialData,
  onReorder,
}: ChapterTreeWrapperProps) {
  const [treeData, setTreeData] = useState<ChapterNode[]>(initialData);

  const handleChange = useCallback((data: TreeItem[]) => {
    // Cast to ChapterNode[] since we know the shape matches
    const chapterData = data as unknown as ChapterNode[];
    setTreeData(chapterData);
    onReorder?.(chapterData);
    return null; // Required by react-sortable-tree
  }, [onReorder]);

  const handleMoveNode = useCallback((args: any) => {
    const { node, nextParentNode, prevPath, nextPath } = args;
    console.log("Moved node:", node);
    console.log("New parent:", nextParentNode);
    console.log("From path:", prevPath, "To path:", nextPath);
  }, []);

  return (
    <div style={{ height: 600 }}>
      <SortableTree
        treeData={treeData as any}
        onChange={handleChange}
        generateNodeProps={({ node }: { node: any }) => ({
          title: node.title,
        })}
        onMoveNode={handleMoveNode}
        canDrop={({ nextParent }: { nextParent: any }) => {
          // Prevent dropping nodes into themselves or their own children
          if (!nextParent) return true;
          return nextParent.isDirectory !== false;
        }}
        canDrag={({ node }: { node: any }) => !node.disableDrag}
        canNodeHaveChildren={(node: any) => node.isDirectory !== false}
      />
    </div>
  );
}
