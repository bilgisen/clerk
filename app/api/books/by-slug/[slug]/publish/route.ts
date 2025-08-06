import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Octokit } from '@octokit/rest';

export async function POST(
  request: Request,
  context: { params: { slug: string } }
) {
  // Get params safely
  const { slug } = context.params;
  try {
    // Get the current user session
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate GitHub token
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error('GitHub token is not configured');
    }
    
    // Initialize Octokit with GitHub token
    const octokit = new Octokit({ auth: githubToken });

    // Get repository information from environment variables
    const owner = process.env.GITHUB_REPO_OWNER;
    const repo = process.env.GITHUB_REPO_NAME;
    
    if (!owner || !repo) {
      throw new Error('GitHub repository information is not properly configured');
    }
    
    const workflowId = 'process-content.yml';
    const ref = 'main';
    const contentId = slug;
    const format = 'epub';

    // Prepare metadata
    const metadata = {
      generatedAt: new Date().toISOString(),
      userId: userId,
      bookSlug: slug
    };

    // Trigger the workflow
    const response = await octokit.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: workflowId,
      ref,
      inputs: {
        content_id: contentId,
        format: format,
        metadata: JSON.stringify(metadata)
      },
    });

    // The response from createWorkflowDispatch doesn't include an ID in the data
    // So we'll use the current timestamp as a reference
    const runId = Date.now();

    return NextResponse.json({
      success: true,
      message: 'EPUB generation started',
      workflowRunId: runId,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error triggering workflow:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new NextResponse(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to trigger EPUB generation',
        message: errorMessage
      }), 
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}
