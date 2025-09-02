// app/api/content/generate/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/better-auth'; // Adjust path based on where your better-auth instance is initialized
import { randomUUID } from 'crypto';

// Types
type EbookFormat = 'pdf' | 'docx' | 'html';

interface GenerateRequest {
  title: string;
  content: string;
  format?: EbookFormat;
  metadata?: Record<string, unknown>;
}

interface ContentGenerationResponse {
  success: boolean;
  contentId: string;
  sessionId: string;
  status: 'processing' | 'completed' | 'failed';
  timestamp: string;
  error?: string;
}

// Content Service
class ContentService {
  static async generateContent(params: {
    title: string;
    content: string;
    format: EbookFormat;
    metadata?: Record<string, unknown>;
    userId: string;
  }) {
    const { title, content, format = 'pdf', metadata, userId } = params;
    const sessionId = randomUUID();

    try {
      // Simulate async processing
      await new Promise(resolve => setTimeout(resolve, 500));

      return {
        success: true,
        contentId: randomUUID(),
        sessionId,
        status: 'processing' as const,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Content generation failed:', error);
      throw new Error('Content generation failed');
    }
  }
}

// POST handler
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json() as GenerateRequest;

    if (!body.title || !body.content) {
      return NextResponse.json(
        { success: false, error: 'Title and content are required' },
        { status: 400 }
      );
    }

    const result = await ContentService.generateContent({
      title: body.title,
      content: body.content,
      format: body.format || 'pdf',
      metadata: body.metadata,
      userId: session.user.id, // Accessing user ID from session
    });

    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    console.error('Content generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}