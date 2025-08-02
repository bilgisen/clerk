import { NextResponse } from 'next/server';
import { ContentService } from '@/lib/services/content.service';
import { GitHubActionsService } from '@/lib/services/github-actions.service';

interface GenerateRequest {
  title: string;
  content: string;
  format: 'pdf' | 'docx' | 'html';
  metadata?: Record<string, any>;
}

export async function POST(request: Request) {
  try {
    const { title, content, format, metadata } = (await request.json()) as GenerateRequest;
    
    // Generate content and get job token
    const { contentId, jobToken } = await ContentService.generateContent({
      title,
      content,
      format,
      metadata,
    });

    // Trigger GitHub Actions workflow
    const workflow = await GitHubActionsService.triggerContentProcessing({
      contentId,
      format,
      metadata: {
        ...metadata,
        jobToken,
      },
    });

    return NextResponse.json({
      success: true,
      contentId,
      jobToken,
      workflowId: workflow.runId,
      status: 'processing',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Content generation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'İçerik oluşturulurken bir hata oluştu' 
      },
      { status: 400 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get('contentId');
    
    if (!contentId) {
      throw new Error('contentId parametresi gerekli');
    }

    const status = await ContentService.getContentStatus(contentId);
    return NextResponse.json(status);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'İçerik durumu alınamadı' },
      { status: 400 }
    );
  }
}
