// lib/r2.ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/**
 * Helper function to safely retrieve environment variables.
 * Throws an error if the variable is not set.
 * @param key - The environment variable key.
 * @returns The value of the environment variable.
 */
const getEnvVar = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set.`);
  }
  return value;
};

// Initialize the S3 client for Cloudflare R2
// It's generally okay to initialize this once, but ensure no state is shared if deployed in an environment requiring it.
const client = new S3Client({
  region: "auto", // Required for Cloudflare R2
  endpoint: `https://${getEnvVar("CLOUDFLARE_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: getEnvVar("R2_UPLOAD_IMAGE_ACCESS_KEY_ID"),
    secretAccessKey: getEnvVar("R2_UPLOAD_IMAGE_SECRET_ACCESS_KEY"),
  },
  // KALDIRILDI: forcePathStyle: true - R2 account endpoint'leriyle imzalama sorunlarına neden olabilir.
  // Bu seçenek kaldırılarak uyumluluk sağlandı.
});

/**
 * Uploads a file to Cloudflare R2 storage.
 *
 * @param key - The key (path) to store the object under in the R2 bucket.
 * @param body - The data to upload (Buffer, Uint8Array, Blob, or string).
 * @param contentType - The MIME type of the file (e.g., 'image/png').
 * @returns A promise that resolves to the public URL of the uploaded object.
 */
export async function uploadToR2({
  key,
  body,
  contentType,
}: {
  key: string;
  body: Buffer | Uint8Array | Blob | string;
  contentType?: string;
}): Promise<string> {
  const bucketName = getEnvVar("R2_UPLOAD_IMAGE_BUCKET_NAME");
  // Public URL artık doğrudan R2 domain'inden oluşturuluyor.
  // Bucket'ınız için doğru Public URL'yi kullandığınızdan emin olun.
  // Örnek: https://pub-<HASH>.r2.dev
  const r2PublicDomain = `https://pub-9622d218dd724cc19fd2873849e9fa58.r2.dev`; 

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
      // Dosyanın herkese açık olmasını sağlamak için ACL eklendi.
      // Bucket yapılandırmanızın buna izin verdiğinden emin olun.
      ACL: "public-read", 
      // Veri bütünlüğünü doğrulamak için isteğe bağlı checksum eklenebilir.
      // ChecksumAlgorithm: "CRC32",
    });

    await client.send(command);

    // Construct and return the public URL
    // Assumes your R2 bucket has public access configured.
    return `${r2PublicDomain}/${key}`;
  } catch (error) {
    console.error("[R2 Upload Error] Failed to upload object with key:", key, error);
    // Re-throw the error so the calling function can handle it appropriately
    throw new Error(`Failed to upload file to R2: ${error instanceof Error ? error.message : String(error)}`);
  }
}