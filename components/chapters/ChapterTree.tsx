"use client";

import { useState } from "react";
import {
  Tree,
  NodeModel,
  DropOptions,
} from "@minoru/react-dnd-treeview";
import { ChapterTreeItem, ChapterNode } from "./ChapterTreeItem";

const initialTree: NodeModel<ChapterNode>[] = [
  { id: 1, parent: 0, droppable: true, text: "Bölüm 1", data: { id: "1", title: "Giriş" } },
  { id: 2, parent: 1, droppable: false, text: "Alt bölüm", data: { id: "2", title: "Ön Bilgi" } },
  { id: 3, parent: 0, droppable: true, text: "Bölüm 2", data: { id: "3", title: "Konu" } },
];

export function ChapterTreeWrapper() {
  const [treeData, setTreeData] = useState<NodeModel<ChapterNode>[]>(initialTree);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleDrop = (newTree: NodeModel<ChapterNode>[], options: DropOptions) => {
    setTreeData(newTree);
    console.log("Dropped:", options);
  };

  return (
    <Tree
      tree={treeData}
      rootId={0}
      render={(node, { depth }) => (
        <ChapterTreeItem
          id={String(node.id)}
          chapter={node.data!}
          level={depth}
          isSelected={selectedId === String(node.id)}
          onSelect={(id) => setSelectedId(id)}
        />
      )}
      dragPreviewRender={(monitorProps) => (
        <div className="px-2 py-1 rounded bg-muted shadow">
          {monitorProps.item.text}
        </div>
      )}
      onDrop={handleDrop}
    />
  );
}
