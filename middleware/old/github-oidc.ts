import { jwtVerify, createRemoteJWKSet, JWTPayload } from 'jose';
import { AuthError, TokenValidationError } from './errors';

const ISSUER = process.env.GITHUB_OIDC_ISSUER || 'https://token.actions.githubusercontent.com';
const AUDIENCE = process.env.GITHUB_OIDC_AUDIENCE || 'https://api.clerko.com';

// GitHub OIDC claims type
type GitHubOidcClaims = {
  // Standard claims
  iss: string;  // Issuer
  sub: string;  // Subject (e.g., 'repo:owner/repo:environment:production')
  aud: string | string[];  // Audience
  exp: number;  // Expiration time
  iat: number;  // Issued at
  nbf?: number; // Not before
  
  // GitHub-specific claims
  repository?: string;  // e.g., 'owner/repo'
  repository_id?: string;
  repository_owner?: string;
  repository_visibility?: 'public' | 'private' | 'internal';
  run_id?: string;
  run_number?: string;
  run_attempt?: string;
  actor?: string;
  actor_id?: string;
  workflow?: string;
  head_ref?: string;
  base_ref?: string;
  event_name?: string;
  ref?: string;
  ref_type?: string;
  environment?: string;
  job_workflow_ref?: string;

  // Allow any other claims
  [key: string]: unknown;
};

// Cache the JWKS to avoid refetching on every request
const JWKS = createRemoteJWKSet(
  new URL(ISSUER.endsWith('/') ? ISSUER + '.well-known/jwks' : ISSUER + '/.well-known/jwks'),
  {
    cooldownDuration: 30000, // 30 seconds cooldown between JWKS refreshes
    timeoutDuration: 5000,   // 5 second timeout for JWKS fetch
  }
);

/**
 * Verifies a GitHub OIDC token and returns its claims
 * @param token The JWT token from GitHub Actions
 * @returns Decoded token claims if valid
 * @throws {TokenValidationError} If token verification fails
 */
export async function verifyGitHubOidcToken(token: string): Promise<GitHubOidcClaims> {
  if (!token) {
    throw new TokenValidationError('No token provided', 'github-oidc');
  }

  try {
    // Verify the JWT using the cached JWKS
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['RS256'],
      clockTolerance: 30, // 30 seconds clock tolerance
    });

    // Type assertion to GitHubOidcClaims
    const claims = payload as GitHubOidcClaims;
    
    // Validate required claims
    if (!claims.iss || !claims.sub || !claims.aud || !claims.exp || !claims.iat) {
      throw new TokenValidationError('Missing required claims', 'github-oidc');
    }

    // Verify the issuer matches
    if (claims.iss !== ISSUER) {
      throw new TokenValidationError(
        `Invalid issuer. Expected: ${ISSUER}`,
        'github-oidc',
        { receivedIssuer: claims.iss }
      );
    }

    // Verify the audience matches
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audience.includes(AUDIENCE)) {
      throw new TokenValidationError(
        `Invalid audience. Expected: ${AUDIENCE}`,
        'github-oidc',
        { receivedAudience: claims.aud }
      );
    }

    // Additional validation for repository format if present
    if (claims.repository) {
      const repoParts = String(claims.repository).split('/');
      if (repoParts.length !== 2 || !repoParts[0] || !repoParts[1]) {
        throw new TokenValidationError(
          'Invalid repository format. Expected: owner/repo',
          'github-oidc',
          { repository: claims.repository }
        );
      }
    }

    return claims;
  } catch (error) {
    if (error instanceof TokenValidationError) {
      throw error; // Re-throw our custom errors
    }
    
    // Handle JWT verification errors
    if (error instanceof Error) {
      if (error.name === 'JWTExpired') {
        throw new TokenValidationError('Token has expired', 'github-oidc');
      }
      if (error.name === 'JWTInvalid') {
        throw new TokenValidationError('Invalid token', 'github-oidc');
      }
      if (error.name === 'JWTClaimValidationFailed') {
        throw new TokenValidationError('Token validation failed', 'github-oidc');
      }
      throw new TokenValidationError(error.message, 'github-oidc');
    }
    
    throw new TokenValidationError('Unknown token validation error', 'github-oidc');
  }
}
