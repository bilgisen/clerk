import { NextResponse } from 'next/server';
import { 
  withSessionAuth, 
  isSessionAuthContext,
  type AuthContextUnion,
  type SessionAuthContext,
  type UnauthorizedContext
} from '@/middleware/auth';
import { randomUUID } from 'crypto';
import type { NextRequest } from 'next/server';

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
      // In a real implementation, you would:
      // 1. Save the content to your database
      // 2. Queue a background job for processing
      // 3. Return a reference to the job
      
      // For now, we'll simulate a successful job creation
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

interface HandlerContext {
  authContext: AuthContextUnion;
  params?: Record<string, string>;
}

// Handler
export const POST = withSessionAuth(async (request: NextRequest, { authContext }: HandlerContext) => {
  if (!isSessionAuthContext(authContext)) {
    return new NextResponse(
      JSON.stringify({ success: false, error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (request.method !== 'POST') {
    return new NextResponse(
      JSON.stringify({ 
        success: false, 
        error: 'Method not allowed' 
      }),
      { 
        status: 405, 
        headers: { 
          'Content-Type': 'application/json',
          'Allow': 'POST'
        } 
      }
    );
  }

  try {
    const body = await request.json() as GenerateRequest;
    
    if (!body.title || !body.content) {
      return new NextResponse(
        JSON.stringify({ 
          success: false, 
          error: 'Title and content are required' 
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    const result = await ContentService.generateContent({
      title: body.title,
      content: body.content,
      format: body.format || 'pdf',
      metadata: body.metadata,
      userId: authContext.userId,
    });

    return new NextResponse(
      JSON.stringify(result),
      { 
        status: 202, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        } 
      }
    );
  } catch (error) {
    console.error('Content generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    return new NextResponse(
      JSON.stringify({ 
        success: false,
        error: errorMessage 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
