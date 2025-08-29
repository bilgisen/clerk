import { Octokit } from '@octokit/rest';

export interface PublishOptions {
  includeMetadata: boolean;
  includeCover: boolean;
  includeTOC: boolean;
  tocLevel: number;
  includeImprint: boolean;
}

export interface TriggerWorkflowParams {
  bookId: string;
  options: PublishOptions;
  userId: string;
  metadata?: Record<string, any>;
}

export class GitHubActionsService {
  private static octokit = new Octokit({
    auth: process.env.GITHUB_PAT || process.env.GITHUB_TOKEN,
  });

  static async triggerWorkflow(params: TriggerWorkflowParams) {
    try {
      const { bookId, options, userId, metadata = {} } = params;

      const owner = process.env.GITHUB_REPO_OWNER;
      const repo = process.env.GITHUB_REPO_NAME;
      const workflowId = process.env.GITHUB_WORKFLOW || 'process-content.yml';

      if (!owner || !repo) {
        throw new Error('GitHub repository owner or name not configured');
      }

      // Prepare workflow inputs
      const inputs: Record<string, string> = {
        book_id: bookId,
        user_id: userId,
        include_metadata: options.includeMetadata.toString(),
        include_cover: options.includeCover.toString(),
        include_toc: options.includeTOC.toString(),
        toc_level: options.tocLevel.toString(),
        include_imprint: options.includeImprint.toString(),
        metadata: JSON.stringify({
          ...metadata,
          timestamp: new Date().toISOString(),
          options: options
        })
      };

      const response = await this.octokit.rest.actions.createWorkflowDispatch({
        owner,
        repo,
        workflow_id: workflowId,
        ref: 'main',
        inputs,
      });

      // The response doesn't include the run ID, so we'll generate a reference ID
      const workflowRunId = `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const workflowUrl = `https://github.com/${owner}/${repo}/actions/runs/${workflowRunId}`;

      return {
        success: true as const,
        status: 'workflow_triggered' as const,
        bookId,
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
