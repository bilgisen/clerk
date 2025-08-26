import { JwtPayload } from 'jsonwebtoken';

export type AuthType = 'clerk' | 'github';

export interface BaseAuthContext {
  type: AuthType;
  userId?: string;
}

export interface ClerkAuthContext extends BaseAuthContext {
  type: 'clerk';
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
}

export interface GitHubAuthContext extends BaseAuthContext {
  type: 'github';
  claims: GitHubOidcClaims;
  workflowRunId?: string;
  actor?: string;
  repository?: string;
  ref?: string;
}

export type AuthContext = ClerkAuthContext | GitHubAuthContext;

export interface GitHubOidcClaims extends JwtPayload {
  // Standard claims
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
  
  // GitHub specific claims
  repository?: string;
  repository_owner?: string;
  repository_id?: string;
  workflow?: string;
  job_workflow_ref?: string;
  ref?: string;
  sha?: string;
  run_id?: string;
  run_number?: string;
  run_attempt?: string;
  actor?: string;
  event_name?: string;
  head_ref?: string;
  base_ref?: string;
  ref_type?: string;
}

export interface AuthError extends Error {
  status: number;
  code: string;
  message: string;
}
