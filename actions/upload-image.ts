"use server";

import { uploadToR2 } from "@/lib/upload/r2";

/**
 * Type for the expected form data structure
 * Extends FormData with specific typing for the file field
 */
type UploadImageFormData = FormData & {
  get(name: 'file'): File | null;
};

/**
 * Handles file upload from a form
 * @param formData - Form data containing the file to upload
 * @returns Promise that resolves to an object containing the public URL of the uploaded file
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

    // Get file extension from the original filename
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    
    if (!allowedExtensions.includes(fileExtension)) {
      throw new Error(`Unsupported file type. Allowed types: ${allowedExtensions.join(', ')}`);
    }
    
    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Generate a unique key with timestamp and sanitized filename
    const sanitizedFilename = file.name
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, "_")
      .replace(/\.(jpg|jpeg|png|webp|gif)$/i, '');
      
    const key = `uploads/${Date.now()}-${sanitizedFilename}.${fileExtension}`;
    
    // Upload to R2 and get the public URL
    const url = await uploadToR2({
      key,
      body: buffer,
      contentType: file.type
    });
    
    return { url };
  } catch (error) {
    console.error("Upload error:", error);
    throw error instanceof Error 
      ? error 
      : new Error("An unknown error occurred during file upload");
  }
}
