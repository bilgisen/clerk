import { NextResponse } from "next/server";
import { Webhooks } from "@octokit/webhooks";
import { getSession, updateSession } from "@/lib/store/redis";

const webhooks = new Webhooks({
  secret: process.env.GITHUB_WEBHOOK_SECRET || "",
});

// Helper to verify GitHub webhook signature
async function verifyWebhook(req: Request): Promise<boolean> {
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

  // Extract session ID from workflow run name or environment
  const sessionId = run.name?.match(/publish-(\w+)/)?.[1];
  if (!sessionId) return;

  // Get the current session
  const session = await getSession(sessionId);
  if (!session) return;

  // Update session based on workflow run status
  const updates: any = {
    gh: {
      ...session.gh,
      run_id: run.id.toString(),
      run_number: run.run_number?.toString(),
      workflow: run.name,
      status: run.status,
      conclusion: run.conclusion,
      html_url: run.html_url,
      created_at: run.created_at,
      updated_at: run.updated_at,
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

  // Find session by run_id
  // Note: This is a simplified example - you might need a better way to map jobs to sessions
  const sessions = await getSessionsByRunId(job.run_id.toString());
  if (!sessions.length) return;

  const session = sessions[0];
  const updates: any = {
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

  await updateSession(session.id, updates);
}

// Helper function to find sessions by GitHub run_id
async function getSessionsByRunId(runId: string) {
  // This is a simplified implementation
  // In a real app, you might want to index sessions by run_id
  const allSessions = await getAllSessions(); // You'll need to implement this
  return allSessions.filter(
    (s: any) => s.gh?.run_id === runId
  );
}
