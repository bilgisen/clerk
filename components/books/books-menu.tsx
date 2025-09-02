"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Loader2 } from "lucide-react";
import toast from "sonner";

interface BooksMenuProps {
  slug: string;  // Book slug for navigation
  bookId: string; // Book ID for API calls
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => Promise<{ success: boolean; error?: string }>;
  onAddChapter?: () => void;
  hideEdit?: boolean; // New prop to hide Edit Book menu item
  activeTab?: string; // Active tab for highlighting
  success?: boolean; // Success state for delete operation
  error?: string; // Error message for delete operation
}

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

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this book? This action cannot be undone.')) {
      return;
    }

    try {
      if (onDelete) {
        // If onDelete is provided, use it
        const result = await onDelete();
        if (result.success) {
          toast.success('Book deleted successfully');
          router.push('/dashboard/books');
          router.refresh();
        } else {
          const errorMessage = result.error || 'Failed to delete book';
          console.error('Delete book error:', errorMessage);
          toast.error(`Error: ${errorMessage}`);
        }
      } else {
        // Fallback to direct API call if onDelete is not provided
        const response = await fetch(`/api/books/${bookId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const errorData = await response.json();
          const errorMessage = errorData?.error || 'Failed to delete book';
          throw new Error(errorMessage);
        }

        toast.success('Book deleted successfully');
        router.push('/dashboard/books');
        router.refresh();
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      console.error('Error deleting book:', error);
      toast.error(`Error: ${errorMessage}`);
    }
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
          onSelect={handleDelete} 
          className="text-red-600 hover:bg-red-50 focus:bg-red-50"
        >
          <span className="flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
            Delete Book
          </span>
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

export { BooksMenu as default };
