// lib/upload/r2.ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
  throw new Error('Missing CLOUDFLARE_ACCOUNT_ID environment variable');
}

if (!process.env.R2_UPLOAD_IMAGE_ACCESS_KEY_ID) {
  throw new Error('Missing R2_UPLOAD_IMAGE_ACCESS_KEY_ID environment variable');
}

if (!process.env.R2_UPLOAD_IMAGE_SECRET_ACCESS_KEY) {
  throw new Error('Missing R2_UPLOAD_IMAGE_SECRET_ACCESS_KEY environment variable');
}

if (!process.env.R2_UPLOAD_IMAGE_BUCKET_NAME) {
  throw new Error('Missing R2_UPLOAD_IMAGE_BUCKET_NAME environment variable');
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_UPLOAD_IMAGE_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_UPLOAD_IMAGE_SECRET_ACCESS_KEY,
  },
});

export async function uploadImageAssets(buffer: Buffer, key: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_UPLOAD_IMAGE_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: "image/*",
    ACL: "public-read",
  });

  try {
    await r2.send(command);
    return `https://storage.bookshall.com/${key}`;
  } catch (error) {
    console.error('Error uploading to R2:', error);
    throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}