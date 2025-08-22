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

export async function uploadImageAssets(buffer: Buffer, key: string, contentType: string): Promise<string> {
  try {
    const command = new PutObjectCommand({
      Bucket: process.env.R2_UPLOAD_IMAGE_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      // R2 doesn't support ACLs, so we'll make it public using a bucket policy
    });

    await r2.send(command);
    
    // Return the public URL
    return `https://${process.env.R2_UPLOAD_IMAGE_BUCKET_NAME}.r2.cloudflarestorage.com/${key}`;
  } catch (error) {
    console.error('Error uploading to R2:', error);
    
    // Log more detailed error information
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error code:', (error as any).$metadata?.httpStatusCode);
      console.error('Error details:', (error as any).$metadata);
    }
    
    throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}