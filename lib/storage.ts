import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true,
});

export async function uploadToStorageAndGetUrl(
  buffer: Buffer,
  key: string
): Promise<string> {
  const bucketName = process.env.S3_BUCKET_NAME;
  
  if (!bucketName) {
    throw new Error('S3_BUCKET_NAME environment variable is not set');
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: 'application/epub+zip',
    ACL: 'public-read',
  });

  try {
    await s3Client.send(command);
    
    // Construct the public URL
    if (process.env.S3_PUBLIC_URL) {
      return `${process.env.S3_PUBLIC_URL}/${key}`;
    } else if (process.env.S3_ENDPOINT) {
      return `${process.env.S3_ENDPOINT}/${bucketName}/${key}`;
    } else {
      return `https://${bucketName}.s3.amazonaws.com/${key}`;
    }
  } catch (error) {
    console.error('Error uploading to storage:', error);
    throw new Error('Failed to upload file to storage');
  }
}
