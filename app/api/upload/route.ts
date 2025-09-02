import { NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/auth/server-auth';
import { uploadToR2 } from '../../../lib/upload/r2';

// 5MB limit for image uploads
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(request: Request) {
  try {
    const { user } = await requireAuth();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return new NextResponse(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return new NextResponse(
        JSON.stringify({ error: 'Invalid file type' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return new NextResponse(
        JSON.stringify({ error: 'File too large (max 5MB)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    try {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      // Generate a clean filename
      const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileExt = originalName.split('.').pop()?.toLowerCase() || 'jpg';
      const fileKey = `uploads/${user.id}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      
      // Upload to R2 using the existing utility
      const fileUrl = await uploadToR2({
        key: fileKey,
        body: buffer,
        contentType: file.type
      });

      // Return the response in the format expected by the editor
      return NextResponse.json({ 
        success: 1, // Required by the editor
        file: {
          url: fileUrl,
          name: file.name,
          size: file.size,
          title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
          type: file.type,
          key: fileKey
        }
      });
    } catch (error) {
      console.error('Upload error:', error);
      return new NextResponse(
        JSON.stringify({ error: 'Failed to upload file' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return new NextResponse(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Authentication required' 
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Route Segment Config
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Disable body parsing since we're handling file uploads
export const maxDuration = 30; // 30 seconds
