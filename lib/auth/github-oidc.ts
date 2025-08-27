import { createRemoteJWKSet, jwtVerify, JWTVerifyResult, JWTPayload } from "jose";

// Extend Error type to include code
interface JWTError extends Error {
  code?: string;
}

// Custom error class for JWT verification
class JWTVerificationError extends Error {
  code: string;
  
  constructor(message: string, code: string) {
    super(message);
    this.name = 'JWTVerificationError';
    this.code = code;
  }
}

const ISSUER = process.env.GITHUB_OIDC_ISSUER || "https://token.actions.githubusercontent.com";
const EXPECTED_AUD = process.env.GITHUB_OIDC_AUD!;

// Cache the JWKS to avoid refetching on every request
const JWKS = createRemoteJWKSet(
  new URL(`${ISSUER}/.well-known/jwks`)
);

export interface GitHubOIDCClaims {
  // Standard JWT claims
  iss: string;         // Issuer (should be "https://token.actions.githubusercontent.com")
  sub: string;         // Subject (format: "repo:org/repo:environment:environmentName" or "repo:org/repo:ref:refs/heads/branch")
  aud: string | string[]; // Audience (should match your expected audience)
  exp: number;         // Expiration time
  iat: number;         // Issued at
  nbf?: number;        // Not before
  jti?: string;        // JWT ID
  
  // GitHub-specific claims
  repository?: string;  // Repository name (e.g., "org/repo")
  repository_id?: string; // GitHub repository ID
  repository_owner?: string; // Repository owner (username or org name)
  repository_owner_id?: string; // GitHub user/org ID
  repository_visibility?: 'public' | 'private' | 'internal';
  run_id?: string;     // GitHub Actions run ID
  run_number?: string; // GitHub Actions run number
  run_attempt?: string; // GitHub Actions run attempt
  actor?: string;      // Username of the user that triggered the workflow
  actor_id?: string;   // GitHub user ID of the user that triggered the workflow
  workflow?: string;   // Workflow name
  head_ref?: string;   // HEAD ref of the workflow run
  base_ref?: string;   // Base ref of the workflow run
  event_name?: string; // Workflow event name (e.g., "push", "pull_request")
  ref?: string;        // Git ref that triggered the workflow
  ref_type?: string;   // Type of ref (e.g., "branch")
  sha?: string;        // Commit SHA that triggered the workflow
  environment?: string; // Environment name
  job_workflow_ref?: string; // Workflow reference (e.g., "org/repo/.github/workflows/ci.yml@refs/heads/main")
  
  // Allow any other claims
  [key: string]: unknown;
}

/**
 * Verifies a GitHub OIDC token and returns its claims
 * @param idToken The JWT token from GitHub Actions
 * @returns Decoded and verified token claims
 * @throws {jose.errors.JOSEError} If token verification fails
 */
export async function verifyGithubOidc(idToken: string): Promise<GitHubOIDCClaims> {
  // Verify the token signature and basic claims
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: ISSUER,
    audience: EXPECTED_AUD,
    algorithms: ["RS256"],
  });

  // Type assertion since we know the shape of GitHub's OIDC token
  const claims = payload as unknown as GitHubOIDCClaims;

  // Additional validation for required GitHub claims
  if (!claims.repository) {
    throw new JWTVerificationError('Repository claim is missing', "ERR_INVALID_CLAIMS");
  }

  if (claims.repository_visibility !== 'private') {
    throw new JWTVerificationError('Repository must be private', "ERR_INVALID_CLAIMS");
  }

  if (claims.repository_id && process.env.GITHUB_REPOSITORY_ID && 
      claims.repository_id !== process.env.GITHUB_REPOSITORY_ID) {
    throw new JWTVerificationError('Invalid repository ID', "ERR_INVALID_CLAIMS");
  }

  if (typeof claims.repository_id !== "string") {
    throw new JWTVerificationError("repository_id is not a string", "ERR_INVALID_CLAIMS");
  }
  if (typeof claims.repository !== "string") {
    throw new JWTVerificationError("repository is not a string", "ERR_INVALID_CLAIMS");
  }
  if (!claims.repository_owner) {
    throw new JWTVerificationError('Repository owner claim is missing', "ERR_INVALID_CLAIMS");
  }

  if (!claims.repository) {
    throw new JWTVerificationError('Repository claim is missing', "ERR_INVALID_CLAIMS");
  }

  if (claims.repository === null) {
    throw new JWTVerificationError('Repository claim is null', "ERR_INVALID_CLAIMS");
  }

  const [owner, repo] = claims.repository.split('/');
  if (owner !== claims.repository_owner) {
    throw new JWTVerificationError(
      `Repository owner ${owner} does not match token owner ${claims.repository_owner}`,
      "ERR_INVALID_OWNER"
    );
  }

  // Validate the subject (sub) claim format
  if (!claims.sub || !claims.repository || !claims.sub.startsWith(`repo:${claims.repository}`)) {
    throw new JWTVerificationError(
      "Invalid subject claim in GitHub OIDC token",
      "ERR_INVALID_CLAIMS"
    );
  }

  if (payload.aud !== EXPECTED_AUD) {
    throw new JWTVerificationError(
      `Invalid audience in OIDC token: expected ${EXPECTED_AUD}, got ${payload.aud}`,
      "ERR_INVALID_CLAIMS"
    );
  }

  return claims;
}

/**
 * Extracts repository information from GitHub OIDC claims
 * @param claims Verified GitHub OIDC claims
 * @returns Repository information in a structured format
 * @throws {JWTVerificationError} If required claims are missing
 */
export function getRepositoryInfo(claims: GitHubOIDCClaims): {
  repository: string;
  repository_id: string;
  repository_owner: string;
  repository_visibility?: 'public' | 'private' | 'internal';
  event_name?: string;
  ref?: string;
  sha?: string;
  environment?: string;
  job_workflow_ref?: string;
} {
  // Ensure required fields are present and have correct types
  if (!claims.repository || typeof claims.repository !== 'string') {
    throw new JWTVerificationError('Invalid or missing repository claim', 'ERR_INVALID_CLAIMS');
  }
  if (!claims.repository_owner || typeof claims.repository_owner !== 'string') {
    throw new JWTVerificationError('Invalid or missing repository owner claim', 'ERR_INVALID_CLAIMS');
  }
  if (!claims.repository_id || typeof claims.repository_id !== 'string') {
    throw new JWTVerificationError('Invalid or missing repository ID claim', 'ERR_INVALID_CLAIMS');
  }

  // Extract only the fields we need and ensure they have the correct types
  const {
    repository,
    repository_id,
    repository_owner,
    repository_visibility,
    event_name,
    ref,
    sha,
    environment,
    job_workflow_ref,
  } = claims;

  return {
    repository,
    repository_id,
    repository_owner,
    ...(repository_visibility && { repository_visibility }),
    ...(event_name && { event_name }),
    ...(ref && { ref }),
    ...(sha && { sha }),
    ...(environment && { environment }),
    ...(job_workflow_ref && { job_workflow_ref }),
  };
}

/**
 * Extracts workflow information from GitHub OIDC claims
 * @param claims Verified GitHub OIDC claims
 * @returns Workflow information in a structured format
 * @throws {JWTVerificationError} If required claims are missing
 */
export function getWorkflowInfo(claims: GitHubOIDCClaims): {
  workflow?: string;
  run_id?: string;
  run_number?: string;
  run_attempt?: string;
  actor?: string;
  event_name?: string;
  ref?: string;
  sha?: string;
  job_workflow_ref?: string;
} {
  // Ensure we have at least some workflow-related information
  if (!claims.workflow && !claims.run_id && !claims.job_workflow_ref) {
    throw new JWTVerificationError(
      'Missing workflow information in OIDC token',
      'ERR_INVALID_CLAIMS'
    );
  }

  // Extract only the fields we need
  const {
    workflow,
    run_id,
    run_number,
    run_attempt,
    actor,
    event_name,
    ref,
    sha,
    job_workflow_ref,
  } = claims;

  return {
    ...(workflow && { workflow }),
    ...(run_id && { run_id }),
    ...(run_number && { run_number }),
    ...(run_attempt && { run_attempt }),
    ...(actor && { actor }),
    ...(event_name && { event_name }),
    ...(ref && { ref }),
    ...(sha && { sha }),
    ...(job_workflow_ref && { job_workflow_ref }),
  };
}

/**
 * Extracts source control information from GitHub OIDC claims
 * @param claims Verified GitHub OIDC claims
 * @returns Source control information in a structured format
 * @throws {JWTVerificationError} If required claims are missing
 */
export function getSourceInfo(claims: GitHubOIDCClaims): {
  ref?: string;
  sha?: string;
  repository?: string;
  repository_owner?: string;
  repository_visibility?: 'public' | 'private' | 'internal';
} {
  // Ensure we have at least some source control information
  if (!claims.repository && !claims.sha && !claims.ref) {
    throw new JWTVerificationError(
      'Missing source control information in OIDC token',
      'ERR_INVALID_CLAIMS'
    );
  }

  // Extract only the fields we need
  const {
    ref,
    sha,
    repository,
    repository_owner,
    repository_visibility,
  } = claims;

  return {
    ...(ref && { ref }),
    ...(sha && { sha }),
    ...(repository && { repository }),
    ...(repository_owner && { repository_owner }),
    ...(repository_visibility && { repository_visibility }),
  };
}
