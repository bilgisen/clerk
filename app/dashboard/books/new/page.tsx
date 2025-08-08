// app/dashboard/books/new/page.tsx
"use client";

export const dynamic = 'force-dynamic';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createBook } from "@/actions/books/create-book";
import { BookInfoForm, BookFormValues } from "@/components/books/forms/book-info-form";
import { Separator } from "@/components/ui/separator";
import { BooksMenu } from "@/components/books/books-menu";

export default function NewBookPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: BookFormValues) => {
    setIsSubmitting(true);
    
    try {
      const formData = new FormData();
      
      // Append all form fields to FormData
      Object.entries(data).forEach(([key, value]) => {
        // Skip undefined, null, and empty strings
        if (value === undefined || value === null || value === '') return;
        
        // Handle arrays (like tags)
        if (Array.isArray(value)) {
          value.forEach(item => formData.append(key, item));
        } else {
          formData.append(key, value.toString());
        }
      });

      const result = await createBook(formData);
      
      if (result.success) {
        toast.success(result.message || "Book created successfully!");
        if (result.redirectTo) {
          router.push(result.redirectTo);
        } else {
          router.push(`/dashboard/books/${result.bookId}`);
        }
      } else {
        toast.error(result.message || "Failed to create book. Please try again.");
      }
    } catch (error) {
      console.error("Error creating book:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 w-full mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Create New Book</h1>
        <div className="flex items-center">
          <BooksMenu 
            slug="new" 
            hideEdit={true}
            onView={() => window.location.href = '/dashboard/books'}
          />
        </div>
      </div>
      <Separator className="mb-6" />
      <BookInfoForm 
        onSubmit={handleSubmit} 
        defaultValues={{
          language: 'tr',
          isPublished: false,
          isFeatured: false,
        }}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
