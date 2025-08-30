import { NextResponse } from 'next/server';
import { withGithubOidcAuth, type HandlerWithAuth } from '@/middleware/auth';
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
  workflowId: string;
  status: 'processing' | 'completed' | 'failed';
  timestamp: string;
  error?: string;
}

// GitHub Actions Service
let Octokit: any;

class GitHubActionsService {
  private static octokit: any;

  static async init() {
    if (!Octokit) {
      const { Octokit: OctokitClass } = await import('@octokit/rest');
      Octokit = OctokitClass;
      this.octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
      });
    }
    return this.octokit;
  }

  static async triggerContentProcessing(params: {
    contentId: string;
    sessionId: string;
    nonce: string;
    metadata?: Record<string, unknown>;
  }) {
    // Initialize Octokit if not already done
    if (!this.octokit) {
      await this.init();
    }
    const { contentId, sessionId, nonce, metadata = {} } = params;
    const owner = process.env.GITHUB_REPO_OWNER || '';
    const repo = process.env.GITHUB_REPO_NAME || '';
    const workflowId = process.env.GITHUB_WORKFLOW || 'process-content.yml';

    if (!owner || !repo) {
      throw new Error('GitHub repository owner or name not configured');
    }

    const response = await this.octokit.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: workflowId,
      ref: 'main',
      inputs: {
        session_id: sessionId,
        nonce,
        content_id: contentId,
        ...metadata,
      },
    });

    const workflowRunId = response.data.id;

    return {
      success: true as const,
      status: 'workflow_triggered' as const,
      contentId,
      sessionId,
      workflowRunId: workflowRunId.toString(),
      triggeredAt: new Date().toISOString(),
    };
  }
}

// Content Service
class ContentService {
  static async generateContent(params: {
    title: string;
    content: string;
    format: EbookFormat;
    metadata?: Record<string, unknown>;
  }) {
    const contentId = `content_${randomUUID()}`;
    
    if (!params.content || params.content.trim().length < 10) {
      throw new Error('Content is too short');
    }

    return {
      contentId,
      status: 'pending' as const,
    };
  }
}

// Handler
const handler: HandlerWithAuth = async (req, context) => {
  try {
    const { authContext } = context || {};
    
    if (authContext?.type !== 'github-oidc') {
      return new NextResponse(
        JSON.stringify({ 
          success: false, 
          error: 'GitHub OIDC authentication required' 
        }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const { title, content, format = 'pdf', metadata } = (await req.json()) as GenerateRequest;
    
    if (!title || !content) {
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

    const { contentId } = await ContentService.generateContent({
      title,
      content,
      format,
      metadata,
    });

    const sessionId = `sess_${randomUUID()}`;
    const nonce = randomUUID();

    const workflow = await GitHubActionsService.triggerContentProcessing({
      contentId,
      sessionId,
      nonce,
      metadata: {
        ...metadata,
        format,
        title,
      },
    });

    const response: ContentGenerationResponse = {
      success: true,
      contentId,
      sessionId,
      workflowId: workflow.workflowRunId,
      status: 'processing',
      timestamp: new Date().toISOString(),
    };

    return new NextResponse(JSON.stringify(response), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
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
};

// Export the handler with GitHub OIDC authentication
export const POST = withGithubOidcAuth(handler);
