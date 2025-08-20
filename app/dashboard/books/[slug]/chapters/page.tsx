// app/dashboard/books/[slug]/chapters/page.tsx
"use client";

import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { ChapterTreeWrapper } from "@/components/chapters/ChapterTree";

export default function ChaptersPage({ params }: { params: { slug: string } }) {
  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Chapters for {params.slug}</h1>
      <DndProvider backend={HTML5Backend}>
        <ChapterTreeWrapper />
      </DndProvider>
    </div>
  );
}
