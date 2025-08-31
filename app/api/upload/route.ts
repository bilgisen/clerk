import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '@/lib/auth/api-auth';

// 5MB limit for image uploads
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(request: Request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' 
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'File is too large. Maximum size is 5MB.' 
        },
        { status: 400 }
      );
    }

    const s3Client = new S3Client({
      region: process.env.CLOUDFLARE_R2_REGION!,
      endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
      },
    });

    // Generate a clean filename
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileExt = originalName.split('.').pop()?.toLowerCase() || '';
    const fileKey = `uploads/${userId}/${uuidv4()}.${fileExt || 'jpg'}`;
    
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
        Key: fileKey,
        Body: buffer,
        ContentType: file.type,
      })
    );

    const publicUrl = `https://${process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN}/${fileKey}`;
    
    // Return the response in the format expected by the editor
    return NextResponse.json({ 
      success: 1, // Required by the editor
      file: {
        url: publicUrl,
        name: file.name,
        size: file.size,
        title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
        type: file.type,
        key: fileKey
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      },
      { status: 500 }
    );
  }
}

// Route Segment Config
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Disable body parsing since we're handling file uploads
export const maxDuration = 30; // 30 seconds
