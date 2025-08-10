import { Octokit } from '@octokit/rest';

export interface TriggerWorkflowParams {
  contentId: string;
  format: string; // epub | mobi
  metadata?: Record<string, any>;
}

export class GitHubActionsService {
  private static octokit = new Octokit({
    auth: process.env.GITHUB_PAT || process.env.GITHUB_TOKEN,
  });

  static async triggerContentProcessing(params: TriggerWorkflowParams) {
    try {
      const { contentId, format, metadata = {} } = params;

      const owner = process.env.GITHUB_REPO_OWNER;
      const repo = process.env.GITHUB_REPO_NAME;
      const workflowFile = process.env.GITHUB_WORKFLOW || 'process-content.yml';

      if (!owner || !repo) {
        throw new Error('GitHub repo owner/name is not configured');
      }

      const inputs: Record<string, string> = {
        content_id: contentId,
        format: format || 'epub',
        metadata: JSON.stringify({
          ...metadata,
          timestamp: new Date().toISOString(),
        }),
      };

      await this.octokit.actions.createWorkflowDispatch({
        // @ts-ignore type quirk in octokit defs
        owner,
        repo,
        workflow_id: workflowFile,
        ref: 'main',
        inputs,
      });

      return {
        success: true as const,
        status: 'workflow_triggered' as const,
        contentId,
        format,
        triggeredAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error triggering GitHub Actions workflow:', error);
      throw new Error('İşlem sırasında bir hata oluştu');
    }
  }
}
