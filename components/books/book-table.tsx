"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Book } from "@/types/book";
import { BooksMenu } from "./books-menu";
import { useRouter } from "next/navigation";

const getColumns = (onDelete?: (bookId: string) => void): ColumnDef<Book>[] => [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("title")}</div>
    ),
  },
  {
    accessorKey: "author",
    header: "Author",
    cell: ({ row }) => (
      <div className="text-muted-foreground">{row.getValue("author")}</div>
    ),
  },
  {
    accessorKey: "publisher",
    header: "Publisher",
    cell: ({ row }) => (
      <div className="text-muted-foreground">
        {row.getValue("publisher") || "-"}
      </div>
    ),
  },
  {
    accessorKey: "language",
    header: "Language",
    cell: ({ row }) => (
      <div className="uppercase">
        {row.getValue("language") || "-"}
      </div>
    ),
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const book = row.original;
      const router = useRouter();

      return (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <BooksMenu
            slug={book.slug}
            onView={() => router.push(`/dashboard/books/${book.slug}`)}
            onEdit={() => router.push(`/dashboard/books/${book.slug}/edit`)}
            onDelete={() => {
              if (onDelete) {
                onDelete(book.id);
              }
            }}
          />
        </div>
      );
    },
  },
];

interface BookTableProps {
  data: Book[];
  isLoading?: boolean;
  onDelete?: (bookId: string) => void;
}

export function BookTable({ data, isLoading = false, onDelete }: BookTableProps) {
  console.log('[BookTable] Rendering with data:', data);
  
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const columns = React.useMemo(() => {
    console.log('[BookTable] Creating columns with onDelete:', !!onDelete);
    return getColumns(onDelete);
  }, [onDelete]);

  console.log('[BookTable] Columns:', columns);
  
  const table = useReactTable({
    debugAll: true,
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                Loading books...
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }
  
  if (data.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center">
        <div className="text-muted-foreground">No books found. Create your first book to get started.</div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    const book = row.original;
                    window.location.href = `/dashboard/books/${book.slug}`;
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No books found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
