import type { User } from '@clerk/nextjs/server';

// Define Clerk auth types without direct dependency on the auth function
export interface ClerkAuth {
  userId: string;
  sessionId: string;
  sessionClaims: {
    sub: string;
    email?: string;
    [key: string]: unknown;
  };
  orgId?: string;
  orgRole?: string;
  getToken: () => Promise<string | null>;
}

export type AuthType = 'clerk' | 'github' | 'api-key';

export interface AuthContext {
  type: AuthType;
  userId?: string;
  email?: string;
  permissions: string[];
  metadata?: Record<string, unknown>;
  
  // GitHub OIDC specific fields
  repository?: string;
  ref?: string;
  workflow?: string;
  actor?: string;
  runId?: string;
  
  // Clerk specific fields
  sessionId?: string;
  orgId?: string;
  orgRole?: string;
  
  // Token metadata
  token?: string;
  expiresAt?: Date;
  issuedAt?: Date;
}

// This interface is replaced by the one above

export interface GitHubOIDCAuth {
  type: 'github';
  repository: string;
  ref: string;
  workflow: string;
  actor: string;
  runId: string;
  permissions: string[];
}

export interface ApiKeyAuth {
  type: 'api-key';
  keyId: string;
  permissions: string[];
}

export type AuthResult = 
  | { type: 'clerk'; auth: ClerkAuth; user: User | null }
  | { type: 'github'; auth: GitHubOIDCAuth }
  | { type: 'api-key'; auth: ApiKeyAuth };

export interface AuthOptions {
  requiredPermissions?: string[];
  allowApiKey?: boolean;
  allowUnauthenticated?: boolean;
}
