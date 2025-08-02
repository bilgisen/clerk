import { Octokit } from '@octokit/rest';

interface TriggerWorkflowParams {
  contentId: string;
  format: string;
  metadata?: Record<string, any>;
}

export class GitHubActionsService {
  private static octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  private static owner = process.env.GITHUB_REPO_OWNER || 'your-username';
  private static repo = process.env.GITHUB_REPO_NAME || 'your-repo';
  private static workflowId = 'process-content.yml';

  static async triggerContentProcessing(params: TriggerWorkflowParams) {
    try {
      const { contentId, format, metadata = {} } = params;
      
      const response = await this.octokit.actions.createWorkflowDispatch({
        owner: this.owner,
        repo: this.repo,
        workflow_id: this.workflowId,
        ref: 'main',
        inputs: {
          content_id: contentId,
          format,
          metadata: JSON.stringify(metadata),
          timestamp: new Date().toISOString(),
        } as { [key: string]: string },
      });

      // The response from createWorkflowDispatch doesn't include an ID,
      // so we'll use the current timestamp as a reference
      const runId = Date.now();
      
      return {
        success: true,
        runId,
        status: 'workflow_triggered',
        contentId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error triggering GitHub Actions workflow:', error);
      throw new Error('İşlem sırasında bir hata oluştu');
    }
  }

  static async getWorkflowStatus(runId: number) {
    try {
      const response = await this.octokit.actions.getWorkflowRun({
        owner: this.owner,
        repo: this.repo,
        run_id: runId,
      });

      return {
        status: response.data.status,
        conclusion: response.data.conclusion,
        htmlUrl: response.data.html_url,
        updatedAt: response.data.updated_at,
      };
    } catch (error) {
      console.error('Error fetching workflow status:', error);
      throw new Error('İşlem durumu alınamadı');
    }
  }
}
