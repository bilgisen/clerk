"use client";

import React from 'react';
import dynamic from "next/dynamic";
import type { ChapterContentEditorProps } from './ChapterContentEditor';

const DynamicChapterContentEditor = dynamic<ChapterContentEditorProps>(
  () => import("./ChapterContentEditor").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[400px] border rounded-md p-4">Loading editor...</div>
    ),
  }
) as React.ComponentType<ChapterContentEditorProps>;

export { DynamicChapterContentEditor as default };
