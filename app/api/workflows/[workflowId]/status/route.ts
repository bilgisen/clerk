import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';

// Initialize Octokit with dynamic import
let Octokit: any;
let octokit: any;

// Load Octokit dynamically
if (process.env.GITHUB_TOKEN) {
  import('@octokit/rest').then(module => {
    Octokit = module.Octokit;
    octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
  }).catch(error => {
    console.error('Failed to load @octokit/rest:', error);
  });
}

export async function GET(
  request: Request,
  context: { params: { workflowId: string } }
) {
  const { workflowId } = context.params;
  try {
    // Authenticate the user
    const session = await auth();
    const userId = session.userId;
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    if (!workflowId) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      );
    }
    
    // Get the book by workflow ID
    const book = await db.query.books.findFirst({
      where: (books: { workflowId: string }, { eq }: any) => eq(books.workflowId, workflowId as string)
    });
    
    if (!book) {
      return NextResponse.json(
        { error: 'Book not found for this workflow' },
        { status: 404 }
      );
    }

    // Check if the user has access to this book
    if (book.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    // If the book already has an EPUB URL, return it
    if (book.epubUrl) {
      return NextResponse.json({
        status: 'completed',
        epubUrl: book.epubUrl,
        updatedAt: book.updatedAt
      });
    }
    
    // Check GitHub Actions workflow status
    try {
      // Extract owner and repo from environment variables
      const [owner, repo] = (process.env.GITHUB_REPOSITORY || '').split('/');
      
      if (!owner || !repo) {
        throw new Error('GitHub repository information not configured');
      }
      
      // Get the workflow run
      const { data: workflowRun } = await octokit.actions.getWorkflowRun({
        owner,
        repo,
        run_id: parseInt(workflowId, 10)
      });
      
      // Map GitHub status to our status
      let status = workflowRun.status;
      if (workflowRun.status === 'completed') {
        status = workflowRun.conclusion === 'success' ? 'completed' : 'failed';
      }
      
      return NextResponse.json({
        status,
        workflowStatus: workflowRun.status,
        conclusion: workflowRun.conclusion,
        htmlUrl: workflowRun.html_url,
        updatedAt: workflowRun.updated_at
      });
      
    } catch (error) {
      console.error('Error checking GitHub workflow status:', error);
      // Fall back to the book's publish status if we can't check GitHub
      return NextResponse.json({
        status: book.publishStatus?.toLowerCase() || 'unknown',
        error: 'Failed to check workflow status',
        updatedAt: book.updatedAt
      });
    }

    // Return the status and any relevant data
    return NextResponse.json({
      status: book.publishStatus?.toLowerCase() || 'unknown',
      epubUrl: book.epubUrl,
      updatedAt: book.updatedAt
    });

  } catch (error) {
    console.error('Error checking workflow status:', error);
    return NextResponse.json(
      { error: 'Failed to check workflow status' },
      { status: 500 }
    );
  }
}

// Add TypeScript type for the route parameters
type Params = {
  params: {
    workflowId: string;
  };
};
