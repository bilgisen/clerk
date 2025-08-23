import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const getEnvVar = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
};

const client = new S3Client({
  region: "auto",
  endpoint: `https://${getEnvVar("CLOUDFLARE_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: getEnvVar("R2_UPLOAD_IMAGE_ACCESS_KEY_ID"),
    secretAccessKey: getEnvVar("R2_UPLOAD_IMAGE_SECRET_ACCESS_KEY"),
  },
  forcePathStyle: true, // ✅ R2 için gerekli
});

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
  const r2PublicDomain = `https://pub-9622d218dd724cc19fd2873849e9fa58.r2.dev`;

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
      // ❌ ACL kaldırıldı
      // ❌ Checksum kullanılmıyor
    });

    await client.send(command);

    return `${r2PublicDomain}/${key}`;
  } catch (error) {
    console.error("[R2 Upload Error]", error);
    throw error;
  }
}
