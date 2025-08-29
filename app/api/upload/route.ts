// app/api/upload/route.ts
import { NextResponse } from 'next/server';
import { uploadImage } from '@/actions/upload-image';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const { userId } = getAuth(request as unknown as Request);
    const { url } = await uploadImage(formData);
    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 400 }
    );
  }
}

export const runtime = 'nodejs';

export const config = {
  api: {
    bodyParser: false,
  },
};
