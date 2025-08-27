import { Octokit } from "@octokit/rest";
import { env } from "@/env.mjs";

// Initialize Octokit with environment token
const octokit = new Octokit({
  auth: env.GITHUB_TOKEN,
  userAgent: 'clerk-publish/1.0.0',
  timeZone: 'UTC',
  request: {
    timeout: 5000,
  },
});

export interface WorkflowDispatchParams {
  owner: string;
  repo: string;
  workflowId: string;
  ref: string;
  inputs?: Record<string, string>;
}

export async function dispatchWorkflow({
  owner,
  repo,
  workflowId,
  ref,
  inputs = {},
}: WorkflowDispatchParams) {
  try {
    const response = await octokit.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: workflowId,
      ref,
      inputs,
    });

    return {
      status: response.status,
      headers: response.headers,
      data: response.data,
    };
  } catch (error) {
    console.error('Failed to dispatch workflow:', error);
    throw new Error('Failed to trigger GitHub Actions workflow');
  }
}

export async function getWorkflowRun({
  owner,
  repo,
  runId,
}: {
  owner: string;
  repo: string;
  runId: number;
}) {
  try {
    const response = await octokit.actions.getWorkflowRun({
      owner,
      repo,
      run_id: runId,
    });

    return response.data;
  } catch (error) {
    console.error('Failed to get workflow run:', error);
    throw new Error('Failed to fetch workflow run details');
  }
}

export async function listWorkflowRuns({
  owner,
  repo,
  workflowId,
  branch,
  event,
  status,
  perPage = 10,
  page = 1,
}: {
  owner: string;
  repo: string;
  workflowId: string;
  branch?: string;
  event?: string;
  status?: string;
  perPage?: number;
  page?: number;
}) {
  try {
    const response = await octokit.actions.listWorkflowRuns({
      owner,
      repo,
      workflow_id: workflowId,
      branch,
      event,
      status: status as any,
      per_page: perPage,
      page,
    });

    return response.data;
  } catch (error) {
    console.error('Failed to list workflow runs:', error);
    throw new Error('Failed to fetch workflow runs');
  }
}

export async function getWorkflowRunLogs({
  owner,
  repo,
  runId,
}: {
  owner: string;
  repo: string;
  runId: number;
}) {
  try {
    const response = await octokit.actions.downloadWorkflowRunLogs({
      owner,
      repo,
      run_id: runId,
    });

    return response.data;
  } catch (error) {
    console.error('Failed to get workflow logs:', error);
    throw new Error('Failed to fetch workflow logs');
  }
}

// Helper function to parse repository owner and name from full name
export function parseRepoFullName(fullName: string) {
  const [owner, repo] = fullName.split('/');
  return { owner, repo };
}

// Helper to get the default branch of a repository
export async function getDefaultBranch(owner: string, repo: string) {
  try {
    const { data } = await octokit.repos.get({
      owner,
      repo,
    });
    return data.default_branch;
  } catch (error) {
    console.error('Failed to get default branch:', error);
    throw new Error('Failed to fetch repository information');
  }
}
