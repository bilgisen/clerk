"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface BookInfoProps {
  book: {
    id: string;
    title: string;
    author?: string | null;
    publisher?: string | null;
    coverImageUrl?: string | null;
  };
  className?: string;
  showEditButton?: boolean;
  editHref?: string;
}

export function BookInfo({ 
  book, 
  className,
  showEditButton = false,
  editHref = "#"
}: BookInfoProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["book", book.id],
    queryFn: async () => {
      // Simulate API call or fetch additional data if needed
      return book;
    },
    initialData: book,
  });

  if (isLoading) {
    return <BookInfoSkeleton />;
  }

  return (
    <div className={cn("flex flex-col space-y-4", className)}>
      <div className="relative aspect-[2/3] w-full max-w-xs rounded-lg overflow-hidden bg-muted">
        {data.coverImageUrl ? (
          <Image
            src={data.coverImageUrl}
            alt={`Cover of ${data.title}`}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted/50">
            {showEditButton ? (
              <Link
                href={editHref}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors text-center p-4"
              >
                Upload Cover Image
              </Link>
            ) : (
              <span className="text-muted-foreground">No cover image</span>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold tracking-tight line-clamp-2">
            {data.title}
          </h3>
          {(data.author || data.publisher) && (
            <p className="text-sm text-muted-foreground">
              {data.author && <span>{data.author}</span>}
              {data.author && data.publisher && <span> • </span>}
              {data.publisher && <span>{data.publisher}</span>}
            </p>
          )}
        </div>
        
        {showEditButton && (
          <Link
            href={editHref}
            className="inline-flex items-center text-sm text-primary hover:underline"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-1.5 h-4 w-4"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit Book Details
          </Link>
        )}
      </div>
    </div>
  );
}

function BookInfoSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="aspect-[2/3] w-full max-w-xs" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}