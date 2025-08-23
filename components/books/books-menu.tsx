"use client";

import { useRouter } from "next/navigation";
import { deleteBook } from "@/actions/books/delete-book";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical } from "lucide-react";
import { useEffect, useState } from "react";

type BooksMenuProps = {
  slug: string;  // Book slug for navigation
  bookId: string; // Book ID for API calls
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => Promise<{success: boolean; error?: string}>;
  onAddChapter?: () => void;
  hideEdit?: boolean; // New prop to hide Edit Book menu item
  activeTab?: string; // Active tab for highlighting
};

export function BooksMenu({
  slug,
  bookId,
  onView,
  onEdit,
  onDelete,
  onAddChapter,
  hideEdit = false, // Default to false for backward compatibility
}: BooksMenuProps) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    console.log('BooksMenu - slug:', slug); // Debug log
    setIsMounted(true);
  }, [slug]); // Add slug to dependency array to log when it changes

  if (!isMounted || !slug) {
    // Return a placeholder button while hydrating or if slug is missing
    return (
      <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
        <MoreVertical className="h-4 w-4" />
      </Button>
    );
  }

  const go = (path: string) => {
    router.push(path);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={() => onView?.() ?? go(`/dashboard/books/${slug}`)}>
          View Book
        </DropdownMenuItem>
        {!hideEdit && (
          <DropdownMenuItem onSelect={() => onEdit?.() ?? go(`/dashboard/books/${slug}/edit`)}>
            Edit Book
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={async () => {
            if (!confirm("Are you sure you want to delete this book?")) return;
            
            try {
              const result = onDelete 
                ? await onDelete()
                : await deleteBook(bookId);
                
              if (result.success) {
                router.push('/dashboard/books');
                router.refresh();
              } else {
                alert(result.error || 'Failed to delete book');
              }
            } catch (error) {
              console.error('Error deleting book:', error);
              alert('An error occurred while deleting the book');
            }
          }}
          className="text-red-600"
        >
          Delete Book
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onAddChapter?.() ?? go(`/dashboard/books/${slug}/chapters/new`)}>
          Add Chapter
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => go(`/dashboard/books/${slug}/chapters`)}>
          View Chapters
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => go(`/dashboard/books/${slug}/publish`)}>
          Publish Book
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
