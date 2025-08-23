// app/actions/uploadImage.ts (or your relevant path)
"use server";

import { uploadToR2 } from "@/lib/upload/r2"; // Ensure this path matches your fixed lib/r2.ts

/**
 * Type for the expected form data structure.
 * While extending FormData directly like this is not standard TS,
 * we can use it for documentation or type assertion purposes.
 */
type UploadImageFormData = FormData & {
  get(name: 'file'): File | null;
};

/**
 * Handles file upload from a form to Cloudflare R2 storage.
 *
 * @param formData - Form data containing the file to upload (key: 'file').
 * @returns Promise that resolves to an object containing the public URL of the uploaded file.
 * @throws {Error} If the upload fails, no file is provided, or file type is invalid.
 */
export async function uploadImage(formData: UploadImageFormData): Promise<{ url: string }> {
  try {
    // 1. Extract the file
    const file = formData.get("file");

    // 2. Validate file presence and type
    if (!(file instanceof File) || !file.name || file.size === 0) {
      console.warn("Upload attempt failed: No valid file provided.");
      throw new Error("No file provided or file is empty.");
    }

    // 3. Validate MIME type (basic check)
    if (!file.type.startsWith("image/")) {
      console.warn(`Upload attempt failed: Invalid MIME type '${file.type}'.`);
      throw new Error("Only image files are allowed.");
    }

    // 4. Validate file extension
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

    if (!allowedExtensions.includes(fileExtension)) {
      console.warn(`Upload attempt failed: Invalid file extension '.${fileExtension}'.`);
      throw new Error(`Unsupported file type. Allowed types: ${allowedExtensions.join(', ')}`);
    }

    // 5. Convert file to buffer for upload
    // Note: await file.arrayBuffer() is the standard way in modern environments (Node 18+, Edge)
    let buffer: Buffer | Uint8Array;
    try {
        // For Node.js environment, Buffer.from is appropriate
        buffer = Buffer.from(await file.arrayBuffer());
    } catch (conversionError) {
         console.error("Error converting file to buffer:", conversionError);
         throw new Error("Failed to process the uploaded file.");
    }

    // 6. Generate a unique key for storage
    // Using Date.now() is generally fine, but ensure system clock is correct.
    // Consider using a more robust unique ID generator (e.g., uuid) if collisions are a concern,
    // though Date.now() + filename is usually sufficient for simple cases.
    const sanitizedFilename = file.name
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, "_")
      .replace(/\.(jpg|jpeg|png|webp|gif)$/i, ''); // Remove extension before re-adding

    const key = `uploads/${Date.now()}-${sanitizedFilename}.${fileExtension}`;

    // 7. Upload to R2
    // The uploadToR2 function should now handle its own validation and error throwing.
    const url = await uploadToR2({
      key,
      body: buffer,
      contentType: file.type,
    });

    console.log(`File uploaded successfully: ${key}`);
    return { url };

  } catch (error: unknown) {
    // 8. Centralized error logging and re-throwing
    // Log the full error details server-side for debugging.
    console.error("Upload action failed:", error);

    // Provide a user-friendly error message.
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during file upload.";
    // Optionally, differentiate between user errors and server errors for the client if needed.
    throw new Error(errorMessage);
  }
}