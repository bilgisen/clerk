// app/dashboard/books/[slug]/chapters/page.tsx
"use client";

import { ChapterTreeWrapper } from "@/components/chapters/ChapterTree";

export default function ChaptersPage({ params }: { params: { slug: string } }) {
  // slug ile kitabın chapterlarını fetch edip ChapterTreeWrapper'a verebilirsin.
  // Şimdilik demo olarak initialTree kullanıyor.
  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Chapters for {params.slug}</h1>
      <ChapterTreeWrapper />
    </div>
  );
}
