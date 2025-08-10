import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getAuth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { userId } = getAuth(request as any);
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const key = request.headers.get('X-File-Key');

    if (!file || !key) {
      return new NextResponse('Missing file or key', { status: 400 });
    }

    // Initialize S3 client for R2
    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_UPLOAD_IMAGE_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_UPLOAD_IMAGE_SECRET_ACCESS_KEY!,
      },
    });

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to R2
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_UPLOAD_IMAGE_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        ACL: 'public-read',
      })
    );

    // Construct the public URL
    const url = `https://${process.env.R2_UPLOAD_IMAGE_BUCKET_NAME}.r2.cloudflarestorage.com/${key}`;

    return NextResponse.json({
      success: true,
      url,
      key,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return new NextResponse(
      JSON.stringify({
        success: false,
        message: 'Failed to upload image',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
