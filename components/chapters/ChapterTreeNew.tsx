"use client";

import React, { useState, useEffect } from "react";
import { DndContext, DragEndEvent, closestCenter } from "@dnd-kit/core";
import { 
  SortableContext, 
  useSortable,
  arrayMove,
  verticalListSortingStrategy 
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { ChapterNode } from '@/types/dnd';

interface ChapterTreeProps {
  chapters: ChapterNode[];
  onChaptersChange?: (chapters: ChapterNode[]) => void;
  onChapterSelect?: (chapter: ChapterNode) => void;
  selectedChapterId?: string | null;
}

const ChapterItem: React.FC<{
  chapter: ChapterNode;
  onSelect: (chapter: ChapterNode) => void;
  isSelected: boolean;
}> = ({ chapter, onSelect, isSelected }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: chapter.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex items-center p-2 rounded cursor-move ${
        isSelected ? 'bg-blue-100' : 'hover:bg-gray-100'
      }`}
      onClick={() => onSelect(chapter)}
    >
      <span className="flex-grow">{chapter.title}</span>
      {chapter.children && chapter.children.length > 0 && (
        <span className="text-gray-400 text-sm">
          {chapter.children.length} {chapter.children.length === 1 ? 'child' : 'children'}
        </span>
      )}
    </div>
  );
};

export const ChapterTree: React.FC<ChapterTreeProps> = ({
  chapters = [],
  onChaptersChange,
  onChapterSelect,
  selectedChapterId,
}) => {
  const [localChapters, setLocalChapters] = useState<ChapterNode[]>(chapters);

  useEffect(() => {
    setLocalChapters(chapters);
  }, [chapters]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    setLocalChapters((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex);
      
      // Update the order property based on new position
      const updatedItems = newItems.map((item: ChapterNode, index: number) => ({
        ...item,
        order: index,
        // Keep the existing parent_chapter_id
        parent_chapter_id: item.parent_chapter_id,
      }));

      onChaptersChange?.(updatedItems);
      return updatedItems;
    });
  };

  const renderChapter = (chapter: ChapterNode, parentId: string | null = null) => {
    const hasChildren = chapter.children && chapter.children.length > 0;
    const isSelected = selectedChapterId === chapter.id;
    
    return (
      <div key={chapter.id} className="mb-1">
        <ChapterItem
          chapter={chapter}
          onSelect={(chapter) => onChapterSelect?.(chapter)}
          isSelected={isSelected}
        />
        {hasChildren && (
          <div className="ml-4">
            <SortableContext items={chapter.children?.map(c => c.id) || []}>
              {chapter.children?.map((child) => (
                <div key={child.id} className="pl-4">
                  {renderChapter(child, chapter.id)}
                </div>
              ))}
            </SortableContext>
          </div>
        )}
      </div>
    );
  };

  const rootChapters = localChapters.filter((chapter) => !chapter.parentId);
  const rootChapterIds = rootChapters.map((chapter) => chapter.id);

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="space-y-1">
        <SortableContext items={rootChapterIds}>
          {rootChapters.map((chapter) => (
            <div key={chapter.id}>
              {renderChapter(chapter)}
            </div>
          ))}
        </SortableContext>
      </div>
    </DndContext>
  );
};
