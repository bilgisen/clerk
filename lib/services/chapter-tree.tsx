"use client";

import React, { useState, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface ChapterNode {
  id: string;
  title: string;
  order: number;
  parentId: string | null;
  children?: ChapterNode[];
  book_id?: string;
  created_at?: string;
  updated_at?: string;
  level?: number;
  isEditing?: boolean;
  isExpanded?: boolean;
  content?: string;
}

interface ChapterTreeProps {
  initialChapters: ChapterNode[];
  onChaptersChange?: (chapters: ChapterNode[]) => void;
  onChapterSelect?: (chapter: ChapterNode) => void;
  selectedChapterId?: string | null;
}

// ✅ Use plain function type instead of React.FC
const ChapterItem = ({
  chapter,
  onSelect,
  isSelected,
}: {
  chapter: ChapterNode;
  onSelect: (chapter: ChapterNode) => void;
  isSelected: boolean;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: chapter.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex items-center p-2 rounded cursor-move ${
        isSelected ? "bg-blue-100" : "hover:bg-gray-100"
      }`}
      onClick={() => onSelect(chapter)}
    >
      <span className="mr-2">{chapter.children?.length ? "📁" : "📄"}</span>
      <span className="flex-1">{chapter.title}</span>
    </div>
  );
};

export const ChapterTree = ({
  initialChapters = [],
  onChaptersChange,
  onChapterSelect,
  selectedChapterId,
}: ChapterTreeProps) => {
  const [chapters, setChapters] = useState<ChapterNode[]>(initialChapters);

  useEffect(() => {
    setChapters(initialChapters);
  }, [initialChapters]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setChapters((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over!.id);

      if (oldIndex === -1 || newIndex === -1) return items;

      const newItems = [...items];
      const [movedItem] = newItems.splice(oldIndex, 1);
      newItems.splice(newIndex, 0, movedItem);

      const updatedItems = newItems.map((item, index) => ({
        ...item,
        order: index,
      }));

      onChaptersChange?.(updatedItems);
      return updatedItems;
    });
  };

  const rootChapters = chapters.filter((chapter) => !chapter.parentId);
  const rootIds = rootChapters.map((ch) => ch.id);

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="space-y-1">
        <SortableContext items={rootIds} strategy={verticalListSortingStrategy}>
          {rootChapters.map((chapter) => (
            <div key={chapter.id}>
              <ChapterItem
                chapter={chapter}
                onSelect={(ch) => onChapterSelect?.(ch)}
                isSelected={selectedChapterId === chapter.id}
              />
            </div>
          ))}
        </SortableContext>
      </div>
    </DndContext>
  );
};