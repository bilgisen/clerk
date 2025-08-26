import { jwtVerify, createRemoteJWKSet } from 'jose';
import { AuthError, ConfigurationError, TokenValidationError } from './errors';

interface GitHubOidcClaims {
  // Required claims
  iss: string; // Issuer (e.g., 'https://token.actions.githubusercontent.com')
  sub: string; // Subject (e.g., 'repo:owner/repo:ref:refs/heads/main')
  aud: string | string[]; // Audience (your GitHub App's client ID)
  exp: number; // Expiration time
  iat: number; // Issued at
  nbf?: number; // Not before
  
  // GitHub-specific claims
  repository?: string; // Repository name (e.g., 'owner/repo')
  repository_owner?: string; // Repository owner
  repository_visibility?: 'public' | 'private' | 'internal';
  repository_id?: string;
  run_id?: string;
  run_number?: string;
  run_attempt?: string;
  actor?: string; // GitHub username of the workflow initiator
  workflow?: string; // Workflow name
  head_ref?: string; // PR head ref if this is a PR workflow
  base_ref?: string; // PR base ref if this is a PR workflow
  event_name?: string; // Workflow event name (e.g., 'push', 'pull_request')
  ref?: string; // Git ref (e.g., 'refs/heads/main')
  ref_type?: string; // Type of ref (e.g., 'branch')
  sha?: string; // Commit SHA that triggered the workflow
  environment?: string; // Environment name if this is an environment workflow
  job_workflow_ref?: string; // Workflow reference (e.g., 'owner/repo/.github/workflows/ci.yml@refs/heads/main')
  
  // Additional claims that might be present
  [key: string]: unknown;
}

export interface GitHubAuthContext {
  type: 'github';
  claims: GitHubOidcClaims;
  workflowRunId?: string;
  actor?: string;
  repository?: string;
  ref?: string;
  // Required by AuthContext
  userId: string;  // Using the GitHub OIDC subject (sub) as userId
  email?: string;  // GitHub doesn't provide email in OIDC tokens by default
}

const GITHUB_ISSUER = 'https://token.actions.githubusercontent.com';

// Cache for JWKS client
let jwksClient: ReturnType<typeof createRemoteJWKSet> | null = null;

async function getJwksClient(): Promise<ReturnType<typeof createRemoteJWKSet>> {
  if (!jwksClient) {
    const jwksUri = process.env.GITHUB_OIDC_JWKS_URI || `${GITHUB_ISSUER}/.well-known/jwks`;
    jwksClient = createRemoteJWKSet(new URL(jwksUri), {
      cooldownDuration: 30000, // 30 seconds
      timeoutDuration: 5000, // 5 seconds
    });
  }
  return jwksClient;
}

export interface VerifyGitHubTokenOptions {
  /** Expected audience(s) for the token */
  audience?: string | string[];
  
  /** Allowed repository pattern (e.g., 'owner/repo' or regex) */
  allowedRepo?: string | RegExp;
  
  /** Allowed workflow pattern (e.g., 'ci.yml' or regex) */
  allowedWorkflow?: string | RegExp;
  
  /** Allowed ref pattern (e.g., 'refs/heads/main' or regex) */
  allowedRef?: string | RegExp;
  
  /** Clock tolerance in seconds for token validation */
  clockToleranceSec?: number;
  
  /** Whether to require the workflow to be from the same repository */
  requireWorkflowFromSameRepo?: boolean;
}

/**
 * Validates GitHub OIDC token claims against the provided options
 */
function validateGitHubClaims(claims: GitHubOidcClaims, options: VerifyGitHubTokenOptions): void {
  // Check repository if specified
  if (options.allowedRepo && claims.repository) {
    const repoPattern = options.allowedRepo instanceof RegExp 
      ? options.allowedRepo 
      : new RegExp(`^${options.allowedRepo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
    
    if (!repoPattern.test(claims.repository)) {
      throw new AuthError(
        `Repository '${claims.repository}' is not allowed`,
        'INVALID_REPOSITORY',
        403,
        { repository: claims.repository, allowed: options.allowedRepo }
      );
    }
  }

  // Check workflow if specified
  if (options.allowedWorkflow && claims.workflow) {
    const workflowPattern = options.allowedWorkflow instanceof RegExp
      ? options.allowedWorkflow
      : new RegExp(options.allowedWorkflow);
      
    if (!workflowPattern.test(claims.workflow)) {
      throw new AuthError(
        `Workflow '${claims.workflow}' is not allowed`,
        'INVALID_WORKFLOW',
        403,
        { workflow: claims.workflow, allowed: options.allowedWorkflow }
      );
    }
  }

  // Check ref if specified
  if (options.allowedRef && claims.ref) {
    const refPattern = options.allowedRef instanceof RegExp
      ? options.allowedRef
      : new RegExp(`^${options.allowedRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
      
    if (!refPattern.test(claims.ref)) {
      throw new AuthError(
        `Ref '${claims.ref}' is not allowed`,
        'INVALID_REF',
        403,
        { ref: claims.ref, allowed: options.allowedRef }
      );
    }
  }

  // Verify workflow is from the same repository if required
  if (options.requireWorkflowFromSameRepo && claims.job_workflow_ref && claims.repository) {
    const workflowRepo = claims.job_workflow_ref.split('@')[0].split('/').slice(0, 2).join('/');
    if (workflowRepo !== claims.repository) {
      throw new AuthError(
        'Workflow must be from the same repository',
        'WORKFLOW_REPOSITORY_MISMATCH',
        403,
        { workflowRepo, tokenRepo: claims.repository }
      );
    }
  }
}

/**
 * Verifies a GitHub OIDC token and returns the authentication context
 */
export async function verifyGitHubToken(
  token: string,
  options: VerifyGitHubTokenOptions = {}
): Promise<GitHubAuthContext> {
  try {
    // Get the JWKS client
    const jwksClient = await getJwksClient();
    
    // Get the audience(s) to verify against
    const audience = options.audience || process.env.GITHUB_OIDC_AUDIENCE || [];
    const audiences = Array.isArray(audience) ? audience : [audience];
    
    if (audiences.length === 0) {
      throw new ConfigurationError(
        'No audience specified for GitHub OIDC token verification',
        'GITHUB_OIDC_AUDIENCE'
      );
    }

    try {
      // Verify the JWT
      const { payload } = await jwtVerify(token, jwksClient, {
        issuer: GITHUB_ISSUER,
        audience: audiences,
        algorithms: ['RS256'],
        clockTolerance: options.clockToleranceSec || 60,
      });

      // Type assertion for the payload
      const claims = payload as unknown as GitHubOidcClaims;
      
      // Validate claims against options
      validateGitHubClaims(claims, options);

      // Return the authentication context with required fields
      return {
        type: 'github',
        claims,
        workflowRunId: claims.run_id,
        actor: claims.actor,
        repository: claims.repository,
        ref: claims.ref,
        // Required by AuthContext
        userId: claims.sub, // Using the GitHub OIDC subject as userId
        email: claims.actor ? `${claims.actor}@users.noreply.github.com` : undefined,
      };
    } catch (jwtError) {
      // Convert JWT verification errors to our error types
      if (jwtError instanceof Error) {
        if (jwtError.name === 'JWTExpired') {
          throw new TokenValidationError(
            'GitHub OIDC token has expired',
            'github',
            { expiredAt: (jwtError as any).expiredAt }
          );
        }
        
        if (jwtError.name === 'JWTClaimValidationFailed') {
          throw new TokenValidationError(
            'GitHub OIDC token claim validation failed',
            'github',
            { reason: jwtError.message }
          );
        }
      }
      throw jwtError; // Re-throw if we can't handle it
    }
  } catch (error) {
    // Re-throw our custom errors as-is
    if (error instanceof AuthError || 
        error instanceof ConfigurationError || 
        error instanceof TokenValidationError) {
      throw error;
    }
    
    // Wrap other errors in a generic authentication error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during token verification';
    throw new AuthError(
      `GitHub OIDC token verification failed: ${errorMessage}`,
      'TOKEN_VERIFICATION_FAILED',
      500,
      { cause: error }
    );
  }

}
