import { PublishStatus } from './redis';

export interface SessionFilterOptions {
  status?: PublishStatus[];
  limit?: number;
  offset?: number;
}

export interface SessionListResult {
  sessions: PublishSession[];
  total: number;
}

export interface SessionUpdateData {
  status?: PublishStatus;
  message?: string;
  progress?: number;
  result?: Record<string, unknown>;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
  metadata?: Record<string, unknown>;
  gh?: {
    repository?: string;
    run_id?: string;
    run_number?: string;
    workflow?: string;
    sha?: string;
  };
}

export interface SessionCreateData {
  id: string;
  userId: string;
  nonce: string;
  contentId: string;
  status: PublishStatus;
  message?: string;
  progress?: number;
  phase?: string;
  gh?: {
    repository?: string;
    run_id?: string;
    run_number?: string;
    workflow?: string;
    sha?: string;
  };
  metadata?: Record<string, unknown>;
}
