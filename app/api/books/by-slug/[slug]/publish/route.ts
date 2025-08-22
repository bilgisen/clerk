import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Octokit } from '@octokit/rest';
import { creditService } from '@/lib/services/credits/credit-service';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(
  request: Request,
  context: { params: { slug: string } }
) {
  // Get params safely
  const { slug } = context.params;
  try {
    // Get the current user session
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get the user's database ID using their Clerk ID
    const [user] = await db.select()
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
    
    if (!user) {
      return new NextResponse(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Deduct 10 credits for EPUB publishing
    const creditResult = await creditService.spendCredits({
      userId: user.id,
      amount: 10,
      reason: 'epub_publish',
      idempotencyKey: `publish-epub:${user.id}:${Date.now()}`,
      ref: slug,
      metadata: {
        action: 'epub_publish',
        bookSlug: slug
      }
    });
    
    if (!creditResult.ok) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'Insufficient credits',
          message: 'You do not have enough credits to publish an EPUB'
        }), {
          status: 402, // Payment Required
          headers: { 'Content-Type': 'application/json' }
        }
      );
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
      userId: clerkUserId,
      bookSlug: slug,
      databaseUserId: user.id
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
