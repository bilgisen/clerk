"use client";

import React from "react";
import { cn } from "@/lib/services/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ChapterOption {
  id: string;
  title: string;
  level?: number;
  disabled?: boolean;
}

export interface ParentChapterSelectProps {
  /**
   * Array of chapter options to display in the select
   */
  parentChapters: ChapterOption[];
  /**
   * Currently selected chapter ID or null for "No parent"
   */
  value: string | null | undefined;
  /**
   * Callback when selected chapter changes
   * @param value The selected chapter ID or null for "No parent"
   */
  onChange: (value: string | null) => void;
  /**
   * Whether the select is disabled
   */
  disabled?: boolean;
  /**
   * Additional class names for the select trigger
   */
  className?: string;
  /**
   * Placeholder text when no value is selected
   */
  placeholder?: string;
  /**
   * Whether to show the level indicator for chapters
   */
  showLevelIndicator?: boolean;
}

const getLevelIndicator = (level: number = 0) => {
  return '— '.repeat(level) + ' ';
};

/**
 * A select component for choosing a parent chapter with support for hierarchical display
 */
function ParentChapterSelect({
  parentChapters,
  value,
  onChange,
  disabled = false,
  className,
  placeholder = "Select parent chapter",
  showLevelIndicator = true,
}: ParentChapterSelectProps) {
  const selectValue = value ?? "none";

  const handleChange = (val: string) => {
    onChange(val === "none" ? null : val);
  };

  // Sort chapters by level and then by title
  const sortedChapters = [...parentChapters].sort((a, b) => {
    if (a.level !== b.level) return (a.level || 0) - (b.level || 0);
    return a.title.localeCompare(b.title);
  });

  return (
    <Select 
      value={selectValue} 
      onValueChange={handleChange} 
      disabled={disabled}
    >
      <SelectTrigger className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none" className="font-medium">
          No parent (Top level chapter)
        </SelectItem>
        {sortedChapters.map((chapter) => (
          <SelectItem 
            key={chapter.id} 
            value={chapter.id}
            disabled={chapter.disabled}
            className={cn(
              chapter.disabled ? 'opacity-50 cursor-not-allowed' : '',
              'whitespace-nowrap overflow-hidden text-ellipsis'
            )}
          >
            {showLevelIndicator && getLevelIndicator(chapter.level)}
            {chapter.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export { ParentChapterSelect as default }
