// lib/r2.ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_UPLOAD_IMAGE_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_UPLOAD_IMAGE_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true, // account-level endpoint için şart
});

export async function uploadToR2({
  key,
  body,
  contentType,
}: {
  key: string;
  body: Buffer | Uint8Array | Blob | string;
  contentType?: string;
}) {
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_UPLOAD_IMAGE_BUCKET_NAME!,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  // Cloudflare R2'de public URL doğrudan custom domain üzerinden verilir
  return `${process.env.NEXT_PUBLIC_MEDIA_BASE_URL}/${key}`;
}
