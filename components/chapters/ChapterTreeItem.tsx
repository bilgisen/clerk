"use client";

import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChapterNode = {
  id: string;
  title: string;
};

type ChapterTreeItemProps = {
  id: string;
  chapter: ChapterNode;
  level: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
};

export function ChapterTreeItem({
  id,
  chapter,
  level,
  isSelected,
  onSelect,
}: ChapterTreeItemProps) {
  return (
    <div
      className={cn(
        "flex items-center rounded-lg border p-2 cursor-pointer select-none",
        isSelected && "border-primary bg-accent"
      )}
      style={{ marginLeft: level * 20 }}
      onClick={() => onSelect(id)}
    >
      <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
      <span className="text-sm">{chapter.title}</span>
    </div>
  );
}
