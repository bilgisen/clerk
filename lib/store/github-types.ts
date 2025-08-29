export interface GitHubJobStep {
  name: string;
  status: string;
  conclusion: string | null;
  number: number;
}

export interface GitHubJob {
  id: string;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: string | null;
  started_at: string;
  completed_at?: string | null;
  steps?: GitHubJobStep[];
}

export interface GitHubContext {
  repository?: string;
  run_id?: string;
  run_number?: string;
  workflow?: string;
  sha?: string;
  job?: GitHubJob;
}
