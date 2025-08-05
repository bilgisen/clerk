"use server";

import { z } from "zod";
import { db } from "@/db/drizzle";
import { books, users } from "@/db/schema";
import { redirect } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { eq, and } from 'drizzle-orm';
import { auth } from "@clerk/nextjs/server";

// Helper function to generate a slug from a title
const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')      // Replace spaces with -
    .replace(/--+/g, '-')      // Replace multiple - with single -
    .trim();
};

// Define the schema for book creation form data
const bookSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  author: z.string().min(1, "Author is required").max(255),
  publisher: z.string().min(1, "Publisher is required").max(255),
  description: z.string().max(1000).optional(),
  isbn: z.string().max(20).optional().nullable(),
  publish_year: z.coerce
    .number()
    .int()
    .min(1000, "Year must be a valid year")
    .max(new Date().getFullYear() + 1, "Year cannot be in the future")
    .optional()
    .nullable(),
  language: z.string().min(2, "Language code must be at least 2 characters").max(10).optional(),
  cover_image_url: z.string().url("Invalid URL").or(z.literal("")).optional().nullable(),
});

/**
 * Server action to create a new book
 * @param formData - The form data containing book information
 */
interface CreateBookResult {
  success: boolean;
  message?: string;
  bookId?: string;
  redirectTo?: string;
}

export const createBook = async (formData: FormData): Promise<CreateBookResult> => {
  try {
    // Get the current user session
    const session = await auth();
    const clerkUserId = session?.userId;
    
    if (!clerkUserId) {
      throw new Error("You must be signed in to create a book");
    }
    
    // Look up the database user ID using the Clerk user ID
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
      
    if (!user) {
      throw new Error("User not found in database. Please sign in again.");
    }

    // Parse and validate the form data
    const parsed = bookSchema.safeParse(Object.fromEntries(formData));

    // If validation fails, throw an error with the validation issues
    if (!parsed.success) {
      const errorMessages = parsed.error.issues.map(issue => issue.message).join(", ");
      console.error("Validation error:", errorMessages);
      throw new Error(`Validation failed: ${errorMessages}`);
    }

    // Extract the validated data
    const {
      title,
      author,
      publisher,
      description,
      isbn,
      publish_year,
      language,
      cover_image_url,
    } = parsed.data;

    // Generate a slug from the title if not provided
    const slug = generateSlug(title);

    // Check if a book with this slug already exists for the user
    const [existingBook] = await db
      .select()
      .from(books)
      .where(eq(books.slug, slug))
      .limit(1);

    if (existingBook) {
      throw new Error("A book with this title already exists. Please choose a different title.");
    }

    // Create the new book object with proper types
    const newBook = {
      id: uuidv4(),
      userId: user.id,
      title,
      slug,
      author,
      publisher,
      description: description ?? null,
      isbn: isbn?.trim() || null,
      publishYear: publish_year ?? null,
      language: language?.trim() || null,
      coverImageUrl: cover_image_url?.trim() || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Insert the new book into the database
    const [insertedBook] = await db.insert(books).values(newBook).returning();
    
    if (!insertedBook) {
      throw new Error("Failed to create book. Please try again.");
    }

    // Return success response with redirect information
    return {
      success: true,
      message: "Book created successfully",
      bookId: insertedBook.id,
      redirectTo: `/dashboard/books/${slug}`
    };
  } catch (error) {
    console.error("Error in createBook:", error);
    
    // Return error response
    const errorMessage = error instanceof Error 
      ? error.message 
      : "An unexpected error occurred while creating the book.";
      
    return {
      success: false,
      message: errorMessage
    };
  }
};
