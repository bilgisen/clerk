import { JwtPayload } from 'jsonwebtoken';

export type AuthType = 'clerk' | 'github-oidc';

export interface BaseAuthContext {
  type: AuthType;
  userId: string;
}

export interface ClerkAuthContext extends BaseAuthContext {
  type: 'clerk';
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  sessionId?: string;
  sessionClaims?: Record<string, unknown>;
}

export interface GitHubOidcAuthContext extends BaseAuthContext {
  type: 'github-oidc';
  userId: string;
  claims: GitHubOidcClaims;
  repository?: string;
  repositoryOwner?: string;
  actor?: string;
  ref?: string;
  sha?: string;
  workflow?: string;
  runId?: string;
}

export type AuthContext = ClerkAuthContext | GitHubOidcAuthContext;

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
  repository_visibility?: 'public' | 'private' | 'internal';
  workflow?: string;
  job_workflow_ref?: string;
  ref?: string;
  ref_type?: string;
  sha?: string;
  run_id?: string;
  run_number?: string;
  run_attempt?: string;
  actor?: string;
  actor_id?: string;
  event_name?: string;
  environment?: string;
  head_ref?: string;
  base_ref?: string;
}

export interface AuthError extends Error {
  status: number;
  code: string;
  message: string;
}
