import { PublishStatus } from './redis';
import { GitHubContext } from './github-types';

export interface PublishSession {
  id: string;
  userId: string;
  status: PublishStatus;
  progress: number;
  createdAt: number;
  updatedAt: number;
  gh?: GitHubContext;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

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
  gh?: GitHubContext;
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
  gh?: GitHubContext;
  metadata?: Record<string, unknown>;
}
