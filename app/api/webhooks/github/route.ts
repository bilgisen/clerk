import { NextResponse } from "next/server";
import { getSession, updateSession, type PublishSession, PublishStatus as PublishStatusValue } from "@/lib/store/redis";
import { GitHubJob } from '@/lib/store/github-types';
import { SessionUpdateData } from '@/lib/store/types';

// Dynamic import for ES modules
let Webhooks: any;
let webhooks: any;

// Initialize webhooks if secret is provided
if (process.env.GITHUB_WEBHOOK_SECRET) {
  import('@octokit/webhooks').then(module => {
    Webhooks = module.Webhooks;
    webhooks = new Webhooks({
      secret: process.env.GITHUB_WEBHOOK_SECRET,
    });
  }).catch(error => {
    console.error('Failed to load @octokit/webhooks:', error);
  });
}

// Extend the PublishSession type with our additional fields
type Session = PublishSession & {
  gh?: {
    repository?: string;
    run_id?: string;
    run_number?: string;
    workflow?: string;
    sha?: string;
    job?: GitHubJob;
  };
  workflowRunId?: string;
};


// Helper to verify GitHub webhook signature
async function verifyWebhook(req: Request): Promise<boolean> {
  // Skip verification if webhook secret is not configured
  if (!webhooks) {
    console.warn('GitHub webhook secret not configured. Webhook verification is disabled.');
    return process.env.NODE_ENV !== 'production'; // Only allow in non-production
  }

  const signature = req.headers.get("x-hub-signature-256");
  if (!signature) return false;

  const payload = await req.text();
  return webhooks.verify(payload, signature);
}

export async function POST(req: Request) {
  try {
    // Verify the webhook signature
    const isValid = await verifyWebhook(req);
    if (!isValid) {
      return new NextResponse("Invalid signature", { status: 401 });
    }

    const event = req.headers.get("x-github-event");
    const payload = await req.json();

    // Handle different GitHub events
    switch (event) {
      case "workflow_run":
        await handleWorkflowRun(payload);
        break;
      case "workflow_job":
        await handleWorkflowJob(payload);
        break;
      default:
        console.log(`Unhandled event type: ${event}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return new NextResponse("Webhook handler failed", { status: 500 });
  }
}

interface GitHubWorkflowRunPayload {
  action: string;
  workflow_run: {
    id: number;
    name: string;
    run_number: number;
    status: string;
    conclusion: string | null;
    created_at: string;
    updated_at: string;
    head_sha: string;
    repository: {
      full_name: string;
    };
    workflow_id: number;
    workflow_url: string;
    actor: {
      login: string;
    };
    html_url: string;
  };
}

interface GitHubWorkflowJobPayload {
  action: string;
  workflow_job: {
    id: number;
    run_id: number;
    name: string;
    status: 'queued' | 'in_progress' | 'completed';
    conclusion: string | null;
    started_at: string;
    completed_at: string | null;
    steps?: Array<{
      name: string;
      status: string;
      conclusion: string | null;
      number: number;
    }>;
  };
}

async function handleWorkflowRun(payload: GitHubWorkflowRunPayload) {
  const { action, workflow_run: run } = payload;
  if (!run || !run.id) return;
  
  const sessions = await getSessionsByRunId(run.id.toString());
  if (sessions.length === 0) return;

  // Extract session ID from workflow run name or environment
  const sessionId = run.name?.match(/publish-(\w+)/)?.[1];
  if (!sessionId) return;

  // Get the current session
  const session = await getSession(sessionId);
  if (!session) return;

  // Update session based on workflow run status
  const updates: SessionUpdateData = {
    gh: {
      ...(session.gh || {}),
      run_id: run.id.toString(),
      run_number: run.run_number?.toString(),
      workflow: run.name,
      repository: run.repository?.full_name,
      sha: run.head_sha,
    },
  };

  // Update status based on workflow run state
  if (run.status === "in_progress") {
    updates.status = "processing";
    updates.message = `Workflow ${run.name} is running`;
  } else if (run.status === "completed") {
    if (run.conclusion === "success") {
      updates.status = "completed";
      updates.message = `Workflow ${run.name} completed successfully`;
    } else {
      updates.status = "failed";
      updates.message = `Workflow ${run.name} failed`;
      updates.error = {
        message: run.conclusion || "Workflow failed",
        details: {
          conclusion: run.conclusion,
          html_url: run.html_url,
        },
      };
    }
  }

  await updateSession(sessionId, updates);
}

async function handleWorkflowJob(payload: GitHubWorkflowJobPayload) {
  const { action, workflow_job: job } = payload;
  if (!job || !job.run_id) return;
  
  const sessions = await getSessionsByRunId(job.run_id.toString());
  if (sessions.length === 0) return;
  
  const session = sessions[0];
  // Create a properly typed updates object that matches SessionUpdateData
  const updates: SessionUpdateData & {
    gh: NonNullable<SessionUpdateData['gh']> & {
      job: GitHubJob;
    };
    status: 'processing' | 'completed' | 'failed'; // Matches PublishStatus values
    progress: number;
  } = {
gh: {
      ...session.gh,
      job: {
        id: job.id.toString(),
        name: job.name,
        status: job.status as 'queued' | 'in_progress' | 'completed',
        conclusion: job.conclusion || null,
        started_at: job.started_at,
        completed_at: job.completed_at || null,
        steps: job.steps?.map(step => ({
          name: step.name,
          status: step.status,
          conclusion: step.conclusion || null,
          number: step.number
        }))
      }
    },
    status: (session.status as 'processing' | 'completed' | 'failed') || 'processing',
    progress: 0 // Will be updated below
  };

  // Update progress based on job steps
  if (job.steps?.length) {
    const completedSteps = job.steps.filter(
      (step) => step.conclusion === "success"
    ).length;
    updates.progress = Math.round((completedSteps / job.steps.length) * 100);
  }

  if (session.id) {
    // The updates object now properly matches SessionUpdateData
    await updateSession(session.id, updates);
  }
}

// Helper function to find sessions by GitHub run_id
async function getSessionsByRunId(runId: string): Promise<Session[]> {
  console.warn('getSessionsByRunId not fully implemented - returning empty array');
  return [];
}
