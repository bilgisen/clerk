import { jwtVerify, createRemoteJWKSet } from 'jose';

const ISSUER = process.env.GITHUB_OIDC_ISSUER || 'https://token.actions.githubusercontent.com';
const AUDIENCE = process.env.GITHUB_OIDC_AUDIENCE || 'https://api.clerko.com';

// Cache the JWKS to avoid refetching on every request
const JWKS = createRemoteJWKSet(
  new URL(ISSUER.endsWith('/') ? `${ISSUER}.well-known/jwks` : `${ISSUER}/.well-known/jwks`),
  {
    cooldownDuration: 30000, // 30 seconds cooldown between JWKS refreshes
    timeoutDuration: 5000,   // 5 second timeout for JWKS fetch
  }
);

export interface GitHubOidcClaims {
  // Standard claims
  iss: string;  // Issuer
  sub: string;  // Subject (e.g., 'repo:owner/repo:environment:production')
  aud: string | string[];  // Audience
  exp: number;  // Expiration time
  iat: number;  // Issued at
  
  // GitHub-specific claims
  repository?: string;  // e.g., 'owner/repo'
  repository_id?: string;
  repository_owner?: string;
  actor?: string;
  run_id?: string;
  [key: string]: unknown;
}

/**
 * Verifies a GitHub OIDC token and returns its claims
 * @param token The JWT token from GitHub Actions
 * @returns Decoded token claims if valid
 * @throws Error if token verification fails
 */
export async function verifyGitHubOidcToken(token: string): Promise<GitHubOidcClaims> {
  if (!token) {
    throw new Error('No token provided');
  }

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['RS256'],
    });

    return payload as unknown as GitHubOidcClaims;
  } catch (error) {
    console.error('GitHub OIDC verification failed:', error);
    throw new Error('Invalid or expired token');
  }
}
