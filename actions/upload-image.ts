"use server";

import { uploadImageAssets } from "@/lib/upload/r2";

/**
 * Handles file upload from a form
 * @param formData - Form data containing the file to upload
 * @returns Object containing the public URL of the uploaded file
 * @throws Error if the upload fails or no file is provided
 */
/**
 * Handles file upload from a form
 * @param formData - Form data containing the file to upload
 * @returns Promise that resolves to an object containing the public URL of the uploaded file
 * @throws {Error} If the upload fails or no file is provided
 */
/**
 * Type for the expected form data structure
 * Extends FormData with specific typing for the file field
 */
type UploadImageFormData = FormData & {
  /**
   * Gets the file from the form data
   * @param name The field name (must be 'file')
   * @returns The File object or null if not found
   */
  get(name: 'file'): File | null;
};

/**
 * Handles file upload from a form
 * @param formData - Form data containing the file to upload
 * @returns Promise that resolves to an object containing the public URL of the uploaded file
 * @throws {Error} If the upload fails or no file is provided
 */
/**
 * Handles file upload from a form
 * @param {UploadImageFormData} formData - Form data containing the file to upload
 * @returns {Promise<{ url: string }>} The public URL of the uploaded file
 * @throws {Error} If the upload fails or no file is provided
 */
export async function uploadImage(formData: UploadImageFormData): Promise<{ url: string }> {
  try {
    const file = formData.get("file");
    
    // Type guard to check if the value is a File with a name
    if (!(file instanceof File) || !file.name) {
      throw new Error("No file provided");
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      throw new Error("Only image files are allowed");
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Generate a unique key with timestamp and sanitized filename
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const key = `${Date.now()}-${sanitizedFilename}`;
    
    // Upload to R2 and get the public URL
    const url = await uploadImageAssets(buffer, key);
    
    return { url };
  } catch (error) {
    console.error("Upload error:", error);
    throw error instanceof Error 
      ? error 
      : new Error("An unknown error occurred during file upload");
  }
}
