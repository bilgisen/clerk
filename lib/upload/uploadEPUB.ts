import { S3Client, PutObjectCommand, S3ClientConfig } from "@aws-sdk/client-s3";

// Validate required environment variables
const requiredEnvVars = [
  'CLOUDFLARE_ACCOUNT_ID',
  'R2_UPLOAD_IMAGE_ACCESS_KEY_ID',
  'R2_UPLOAD_IMAGE_SECRET_ACCESS_KEY',
  'R2_UPLOAD_IMAGE_BUCKET_NAME'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
  }
}

const s3Config: S3ClientConfig = {
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_UPLOAD_IMAGE_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_UPLOAD_IMAGE_SECRET_ACCESS_KEY!,
  },
};

const r2 = new S3Client(s3Config);

export async function uploadEPUB(buffer: Buffer, key: string): Promise<string> {
  const bucketName = process.env.R2_UPLOAD_IMAGE_BUCKET_NAME!;

  try {
    await r2.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: 'application/epub+zip',
        ACL: 'public-read',
      })
    );

    // Return the public URL for the uploaded file using the configured base URL
    const baseUrl = process.env.NEXT_PUBLIC_IMAGE_BASE_URL || 
                   `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucketName}`;
    
    // Remove any trailing slashes from base URL
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${cleanBaseUrl}/${key}`;
  } catch (error) {
    console.error('Error uploading EPUB to R2:', error);
    throw new Error(
      error instanceof Error 
        ? `Failed to upload EPUB file: ${error.message}`
        : 'Failed to upload EPUB file'
    );
  }
}
