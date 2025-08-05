import { ColumnDef } from "@tanstack/react-table"
import { Book } from "@/types/book"

type ColumnActions = {
  onView?: (slug: string) => void
  onEdit?: (id: string) => void
  onDelete?: (id: string, title: string) => void
  onAddChapter?: (bookId: string) => void
}

export const getColumns = (): ColumnDef<Book>[] => [
  {
    accessorKey: "title",
    header: "Title",
  },
  {
    accessorKey: "author",
    header: "Author",
  },
  {
    accessorKey: "publisher",
    header: "Publisher",
  },
  {
    accessorKey: "language",
    header: "Language",
  }
]
