import { NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import { auth } from '@clerk/nextjs/server';

type WorkflowResponse = {
  id: number;
  html_url: string;
};

// Initialize Octokit with GitHub token
const octokit = new Octokit({
  auth: process.env.GITHUB_PAT || process.env.GITHUB_TOKEN,
});

export async function POST(request: Request) {
  try {
    // Authenticate the user
    const session = await auth();
    if (!session || !session.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const userId = session.userId;

    // Parse request body
    const { content_id, format, metadata } = await request.json();
    
    if (!content_id) {
      return NextResponse.json(
        { error: 'content_id is required' },
        { status: 400 }
      );
    }

    // Get repository owner and name from environment variables
    const owner = process.env.GITHUB_REPO_OWNER;
    const repo = process.env.GITHUB_REPO_NAME;
    const workflowFile = process.env.GITHUB_WORKFLOW || 'process-content.yml';
    
    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'GitHub repository owner or name not configured' },
        { status: 500 }
      );
    }

    // Trigger the workflow
    const response = await octokit.actions.createWorkflowDispatch({
      // @ts-ignore - Type definition issue with octokit
      owner,
      repo,
      workflow_id: workflowFile,
      ref: 'main',
      inputs: {
        content_id: content_id.toString(),
        format: format || 'epub',
        metadata: JSON.stringify({
          ...(metadata || {}),
          user_id: userId,
          timestamp: new Date().toISOString(),
        }),
      },
    }) as { data: WorkflowResponse };

    // Get the workflow run ID and URL
    const workflowRunId = response.data.id;
    const workflowUrl = response.data.html_url || 
      `https://github.com/${owner}/${repo}/actions/runs/${workflowRunId}`;

    return NextResponse.json({
      success: true,
      workflowRunId,
      workflowUrl,
    });

  } catch (error) {
    console.error('Error triggering workflow:', error);
    return NextResponse.json(
      { 
        error: 'Failed to trigger workflow',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
