"use server";
import { db } from "@/db/drizzle";
import { books, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import slugify from "slugify";
import type { BookGenre } from "@/types/book";

// Define types for the form data
const UpdateBookFormData = z.object({
  id: z.string().uuid({
    message: "Valid book ID is required"
  }),
  title: z.string().min(1, "Title is required").max(255),
  author: z.string().min(1, "Author is required").max(255),
  publisher: z.string().min(1, "Publisher is required").max(255),
  description: z.string().max(1000).optional().default(""),
  isbn: z.string().max(20).optional().nullable(),
  publish_year: z.union([
    z.string()
      .transform(val => val ? parseInt(val, 10) : null)
      .pipe(
        z.number()
          .int("Publish year must be a whole number")
          .min(1000, "Year must be a valid year")
          .max(new Date().getFullYear() + 1, "Year cannot be in the future")
          .nullable()
      ),
    z.number()
      .int("Publish year must be a whole number")
      .min(1000, "Year must be a valid year")
      .max(new Date().getFullYear() + 1, "Year cannot be in the future")
      .nullable()
  ]).optional().nullable(),
  series_index: z.union([
    z.string()
      .transform(val => val ? parseInt(val, 10) : null)
      .pipe(
        z.number()
          .int("Series index must be a whole number")
          .min(1, "Series index must be at least 1")
          .nullable()
      ),
    z.number()
      .int("Series index must be a whole number")
      .min(1, "Series index must be at least 1")
      .nullable()
  ]).optional().nullable(),
  language: z.string().min(2, "Language code must be at least 2 characters").max(10).optional(),
  cover_image_url: z.string().url("Invalid URL").or(z.literal("")).optional().nullable(),
  tags: z.union([
    z.string().transform(str => {
      try {
        const parsed = JSON.parse(str);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
    }),
    z.array(z.string())
  ]).optional().default([]),
  // Add other fields that might come from the form
  subtitle: z.string().optional().default(""),
  publisherWebsite: z.string().optional().default(""),
  genre: z.string().optional(),
  series: z.string().optional().default(""),
  isPublished: z.union([z.boolean(), z.string().transform(val => val === 'true')]).optional().default(false),
  isFeatured: z.union([z.boolean(), z.string().transform(val => val === 'true')]).optional().default(false),
});

/**
 * Updates an existing book
 * @param formData - The form data containing book information to update
 * @returns Object with success status and optional error message or redirect URL
 */
export const updateBook = async (formData: FormData) => {
  try {
    // Parse form data into a plain object
    const formDataObj: Record<string, any> = {};
    
    // Convert FormData to plain object, handling different value types
    for (const [key, value] of formData.entries()) {
      // Skip file uploads as they're handled separately
      if (value instanceof File) continue;
      
      // Handle array fields (like tags)
      if (formDataObj[key] !== undefined) {
        if (!Array.isArray(formDataObj[key])) {
          formDataObj[key] = [formDataObj[key]];
        }
        formDataObj[key].push(value);
      } else {
        formDataObj[key] = value;
      }
    }
    
    console.log('Parsed form data:', formDataObj);
    
    // Convert string values to appropriate types
    const data = {
      ...formDataObj,
      publish_year: formDataObj.publish_year ? String(formDataObj.publish_year) : null,
      series_index: formDataObj.series_index ? String(formDataObj.series_index) : null,
      // Parse tags from JSON string if needed
      tags: (() => {
        try {
          if (Array.isArray(formDataObj.tags)) {
            return formDataObj.tags.flatMap(t => {
              try {
                return typeof t === 'string' ? JSON.parse(t) : t;
              } catch {
                return [];
              }
            }).filter(Boolean);
          }
          if (typeof formDataObj.tags === 'string') {
            const parsed = JSON.parse(formDataObj.tags);
            return Array.isArray(parsed) ? parsed : [parsed].filter(Boolean);
          }
          return [];
        } catch (e) {
          console.error('Error parsing tags:', e);
          return [];
        }
      })()
    };
    
    // Parse and validate the form data
    const parseResult = UpdateBookFormData.safeParse(data);

    if (!parseResult.success) {
      console.error('Validation error:', parseResult.error);
      // Format validation errors into a user-friendly message
      const errorMessages = parseResult.error.issues
        .map(issue => {
          const path = issue.path.join('.');
          return path ? `${path}: ${issue.message}` : issue.message;
        })
        .join('\n');
      
      return {
        success: false,
        error: errorMessages || 'Invalid form data'
      };
    }

    const updateData = parseResult.data;
    
    // Get the current user session
    const session = await auth();
    const clerkUserId = session?.userId;
    
    if (!clerkUserId) {
      console.error('No user ID in session');
      return {
        success: false,
        error: 'You must be signed in to update a book'
      };
    }
    
    // Get the user from the database using the Clerk user ID
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
      
    if (!user) {
      console.error('User not found in database');
      return {
        success: false,
        error: 'User account not found'
      };
    }

    // Verify the book exists and belongs to the user
    const [existingBook] = await db
      .select()
      .from(books)
      .where(
        and(
          eq(books.id, updateData.id),
          eq(books.userId, user.id) // Use the database user ID
        )
      )
      .limit(1);

    if (!existingBook) {
      console.error(`Book not found or access denied: ${updateData.id} for user ${user.id}`);
      return {
        success: false,
        error: 'Book not found or you do not have permission to update it'
      };
    }

    // Generate new slug if title is being updated
    const slug = updateData.title ? 
      slugify(updateData.title, { lower: true, strict: true }) : 
      existingBook.slug;

    // Map the validated data to the database schema with proper types
    const updateValues: Partial<typeof books.$inferInsert> = {
      title: updateData.title,
      author: updateData.author,
      publisher: updateData.publisher || null,
      description: updateData.description || null,
      isbn: updateData.isbn || null,
      publishYear: updateData.publish_year ? Number(updateData.publish_year) : null,
      seriesIndex: updateData.series_index ? Number(updateData.series_index) : null,
      language: updateData.language || 'tr',
      coverImageUrl: updateData.cover_image_url || null,
      slug,
      tags: Array.isArray(updateData.tags) ? updateData.tags : [],
      updatedAt: new Date(),
      isPublished: Boolean(updateData.isPublished),
      isFeatured: Boolean(updateData.isFeatured),
      genre: updateData.genre as BookGenre || null,
      subtitle: updateData.subtitle || null,
      series: updateData.series || null,
      publisherWebsite: updateData.publisherWebsite || null
    };
    
    console.log('Updating book with values:', updateValues);
    
    // Get the book ID from updateData
    const bookId = updateData.id;
    
    const [updatedBook] = await db
      .update(books)
      .set(updateValues)
      .where(eq(books.id, bookId))
      .returning();

    if (!updatedBook) {
      throw new Error("Failed to update book");
    }

    // Revalidate the book page and books list
    revalidatePath(`/dashboard/books/${updatedBook.slug}`);
    revalidatePath('/dashboard/books');

    return {
      success: true,
      redirectUrl: `/dashboard/books/${updatedBook.slug}`
    };
  } catch (error) {
    console.error('Error updating book:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update book'
    };
  }
};
