"use client";

import React, { useState, useEffect } from "react";
import { DndContext, DragEndEvent, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { moveItemToNewParentAndReorder } from "@/lib/services/tree-utils";

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

type ChapterTreeProps = {
  initialChapters: ChapterNode[];
  onChaptersChange?: (chapters: ChapterNode[]) => void;
  onChapterSelect?: (chapter: ChapterNode) => void;
  selectedChapterId?: string | null;
};

const SortableChapterItem = ({ 
  chapter, 
  onSelect, 
  isSelected 
}: { 
  chapter: ChapterNode; 
  onSelect: (chapter: ChapterNode) => void; 
  isSelected: boolean;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: chapter.id });

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
      className={`flex items-center p-2 rounded cursor-move ${isSelected ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
      onClick={() => onSelect(chapter)}
    >
      <span className="mr-2">
        {chapter.children?.length ? '📁' : '📄'}
      </span>
      <span className="flex-1">{chapter.title}</span>
    </div>
  );
};

export function ChapterTree({ 
  initialChapters = [], 
  onChaptersChange, 
  onChapterSelect,
  selectedChapterId 
}: ChapterTreeProps) {
  const [chapters, setChapters] = useState<ChapterNode[]>(initialChapters);

  useEffect(() => {
    setChapters(initialChapters);
  }, [initialChapters]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    const newParentId = over.data.current?.parentId ?? null;
    const newIndex = over.data.current?.index ?? 0;

    const updatedChapters = moveItemToNewParentAndReorder(
      [...chapters],
      active.id.toString(),
      newParentId,
      newIndex
    );

    setChapters(updatedChapters);
    onChaptersChange?.(updatedChapters);
  };

  const renderChapter = (chapter: ChapterNode, parentId: string | null = null) => {
    const hasChildren = chapter.children && chapter.children.length > 0;
    const isSelected = selectedChapterId === chapter.id;

    return (
      <div key={chapter.id} className="pl-4">
        <SortableChapterItem 
          chapter={chapter}
          onSelect={onChapterSelect || (() => {})}
          isSelected={isSelected}
        />
        {hasChildren && (
          <div className="ml-4">
            <SortableContext items={chapter.children?.map(c => c.id) || []}>
              {chapter.children?.map((child) => 
                renderChapter(child, chapter.id)
              )}
            </SortableContext>
          </div>
        )}
      </div>
    );
  };

  const rootChapters = chapters.filter(chapter => chapter.parentId === null);
  const rootChapterIds = rootChapters.map(chapter => chapter.id);

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-1">
        <SortableContext items={rootChapterIds}>
          {rootChapters.map((chapter) => renderChapter(chapter, null))}
        </SortableContext>
      </div>
    </DndContext>
  );
}
