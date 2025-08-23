// app/api/upload/image/route.ts
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
    const file = formData.get('file') as Blob | null;
    const key = request.headers.get('X-File-Key');

    if (!file || !key) {
      return new NextResponse('Missing file or key', { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return new NextResponse('Invalid file type', { status: 400 });
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Initialize S3 client for R2
    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.R2_UPLOAD_IMAGE_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_UPLOAD_IMAGE_SECRET_ACCESS_KEY!,
      },
    });

    // Upload to R2
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_UPLOAD_IMAGE_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      })
    );

    // Return the public URL
    const publicUrl = `https://pub-3cfc29e59e5243f4917194e2466f5fa0.r2.dev/${key}`;

    return NextResponse.json({
      success: 1,
      file: {
        url: publicUrl,
        name: key.split('/').pop(),
        size: buffer.length,
        type: file.type,
      },
      url: publicUrl,
      key: key,
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
