"use client";

import * as React from "react";
import TreeView, { TreeViewItem } from "@/components/tree-view";
import { convertChaptersToTree, buildOrderPayload } from "@/lib/convert-chapters";
import { ChapterNode as ApiChapterNode } from "@/types/dnd";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Plus, Folder } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useUpdateChapterOrder } from "@/hooks/api/use-chapters";

interface ChapterTreeWrapperProps {
  initialChapters: ApiChapterNode[];
  bookId: string;
}

export function ChapterTreeWrapper({ initialChapters, bookId }: ChapterTreeWrapperProps) {
  const updateChapterOrder = useUpdateChapterOrder(bookId);
  const data = convertChaptersToTree(initialChapters);

  const persistOrder = async (tree: TreeViewItem[]) => {
    try {
      const updates = buildOrderPayload(tree).map((u) => ({
        id: u.id,
        order: u.order,
        level: u.level,
        parent_chapter_id: u.parent_chapter_id,
      }));
      await updateChapterOrder.mutateAsync(updates);
      toast.success("Chapter order updated");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update chapter order");
    }
  };

  return (
    <div className="space-y-2">
      <TreeView
        data={data}
        title="Chapters"
        iconMap={{ chapter: <Folder className="h-4 w-4 text-primary/80" /> }}
        menuItems={[
          {
            id: "view",
            label: "View",
            icon: <Eye className="h-4 w-4" />,
            action: (items) => {
              if (items.length) {
                window.location.href = `/dashboard/books/${bookId}/chapters/${items[0].id}`;
              }
            },
          },
          {
            id: "edit",
            label: "Edit",
            icon: <Pencil className="h-4 w-4" />,
            action: (items) => {
              if (items.length) {
                window.location.href = `/dashboard/books/${bookId}/chapters/${items[0].id}/edit`;
              }
            },
          },
        ]}
        onAction={(action, items) => {
          // ekstra: analytics vs.
          // console.log("Action:", action, items);
        }}
        /** tek item taşındığında bilgi verir (UI amaçlı) */
        onMoveItem={(item, newParentId, newIndex) => {
          // console.log("Moved:", item.id, "-> parent:", newParentId, "index:", newIndex);
        }}
        /** drag-drop sonrası tüm ağaçla server'a gönder */
        onTreeChange={(newTree) => {
          void persistOrder(newTree);
        }}
      />

      <div className="mt-4 pl-6">
        <Button asChild variant="outline" size="sm" className="w-full justify-start gap-2">
          <Link href={`/dashboard/books/${bookId}/chapters/new`}>
            <Plus className="h-4 w-4" />
            Add Chapter
          </Link>
        </Button>
      </div>
    </div>
  );
}
