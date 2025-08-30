// app/dashboard/books/new/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookInfoForm, type BookFormValues } from "@/components/books/forms/book-info-form";
import { Separator } from "@/components/ui/separator";
import { BooksMenu } from "@/components/books/books-menu";
import { useCreateBook, type CreateBookInput } from "@/hooks/api/use-books";
import type { Book } from "@/types/book";

export default function NewBookPage() {
  const router = useRouter();
  const { mutate: createBook, isPending: isSubmitting } = useCreateBook();

  const handleSubmit = (formData: BookFormValues) => {
    // Convert form data to CreateBookInput type
    const bookData: CreateBookInput = {
      title: formData.title,
      description: formData.description || undefined,
      // Add any other fields as needed
    };

    createBook(bookData, {
      onSuccess: (response) => {
        toast.success("Book created successfully!");
        if (response?.data?.id) {
          router.push(`/dashboard/books/${response.data.id}`);
        } else {
          router.push('/dashboard/books');
        }
      },
      onError: (error: Error) => {
        console.error("Error creating book:", error);
        toast.error(error.message || "Failed to create book. Please try again.");
      },
    });
  };

  return (
    <div className="p-8 w-full mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Create New Book</h1>
        <div className="flex items-center">
          <BooksMenu 
            slug="new" 
            bookId="new"
            hideEdit={true}
            onView={() => window.location.href = '/dashboard/books'}
          />
        </div>
      </div>
      <Separator className="mb-6" />
      <BookInfoForm 
        onSubmit={handleSubmit} 
        defaultValues={{
          language: 'en',
        }}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
