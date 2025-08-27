import { NextResponse } from "next/server";
import { Webhooks } from "@octokit/webhooks";
import { 
  getSession, 
  updateSession, 
  PublishStatus,
  PublishSession 
} from "@/lib/store/redis";
import type { SessionUpdateData } from "@/lib/store/types";

// Extend the PublishSession type with our additional fields
type Session = PublishSession & {
  gh?: PublishSession['gh'] & {
    job?: {
      id: string;
      name: string;
      status: string;
      conclusion?: string;
      started_at?: string;
      completed_at?: string;
      steps?: Array<{
        name: string;
        status: string;
        conclusion?: string;
        number: number;
      }>;
    };
  };
  workflowRunId?: string;
};

// Only initialize webhooks if secret is provided
const webhooks = process.env.GITHUB_WEBHOOK_SECRET 
  ? new Webhooks({
      secret: process.env.GITHUB_WEBHOOK_SECRET,
    })
  : null;

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

async function handleWorkflowRun(payload: any) {
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

async function handleWorkflowJob(payload: any) {
  const { action, workflow_job: job } = payload;
  if (!job || !job.run_id) return;
  
  const sessions = await getSessionsByRunId(job.run_id.toString());
  if (sessions.length === 0) return;
  
  const session = sessions[0];
  // Create updates object with SessionUpdateData type
  const updates: SessionUpdateData & { gh?: any } = {
    gh: {
      ...session.gh,
      job: {
        id: job.id,
        name: job.name,
        status: job.status,
        conclusion: job.conclusion,
        started_at: job.started_at,
        completed_at: job.completed_at,
        steps: job.steps?.map((step: any) => ({
          name: step.name,
          status: step.status,
          conclusion: step.conclusion,
          number: step.number,
        })),
      },
    },
  };

  // Update progress based on job steps
  if (job.steps?.length) {
    const completedSteps = job.steps.filter(
      (step: any) => step.conclusion === "success"
    ).length;
    updates.progress = Math.round((completedSteps / job.steps.length) * 100);
  }

  if (session.id) {
    await updateSession(session.id, updates);
  }
}

// Helper function to find sessions by GitHub run_id
async function getSessionsByRunId(runId: string): Promise<Session[]> {
  console.warn('getSessionsByRunId not fully implemented - returning empty array');
  return [];
}
