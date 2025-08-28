import { Octokit } from '@octokit/rest';

export interface TriggerWorkflowParams {
  contentId: string;
  sessionId: string;
  nonce: string;
  metadata?: Record<string, any>;
}

export class GitHubActionsService {
  private static octokit = new Octokit({
    auth: process.env.GITHUB_PAT || process.env.GITHUB_TOKEN,
  });

  static async triggerContentProcessing(params: TriggerWorkflowParams) {
    try {
      const { contentId, sessionId, nonce, metadata = {} } = params;

      const owner = process.env.GITHUB_REPO_OWNER;
      const repo = process.env.GITHUB_REPO_NAME;
      const workflowId = process.env.GITHUB_WORKFLOW || 'process-content.yml';

      if (!owner || !repo) {
        throw new Error('GitHub repository owner or name not configured');
      }

      // Extract slug from metadata if available
      const slug = metadata?.slug || `book-${contentId}`;

      const inputs: Record<string, string> = {
        session_id: sessionId,
        nonce: nonce,
        content_id: contentId,
        slug: slug,
        metadata: JSON.stringify({
          ...metadata,
          timestamp: new Date().toISOString(),
        }),
      };

      const response = await this.octokit.rest.actions.createWorkflowDispatch({
        owner,
        repo,
        workflow_id: workflowId,
        ref: 'main',
        inputs,
      });

      const workflowRunId = response.data.id;
      const workflowUrl = `https://github.com/${owner}/${repo}/actions/runs/${workflowRunId}`;

      return {
        success: true as const,
        status: 'workflow_triggered' as const,
        contentId,
        sessionId,
        workflowRunId,
        workflowUrl,
        triggeredAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error triggering workflow:', error);
      return {
        success: false as const,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
