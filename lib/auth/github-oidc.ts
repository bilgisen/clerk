import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AuthError } from './errors';

const ISSUER = process.env.GITHUB_OIDC_ISSUER || "https://token.actions.githubusercontent.com";
const AUDIENCE = process.env.GITHUB_OIDC_AUDIENCE || "https://api.clerko.com";

// Cache the JWKS to avoid refetching on every request
const JWKS = createRemoteJWKSet(
  new URL(
    process.env.GITHUB_OIDC_JWKS_URI || 
    `${ISSUER}/.well-known/jwks`
  )
);

export interface GitHubOidcClaims {
  // Standard JWT claims
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nbf?: number;
  jti?: string;
  
  // GitHub-specific claims
  repository?: string;
  repository_id?: string;
  repository_owner?: string;
  repository_owner_id?: string;
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
  sha?: string;
  environment?: string;
  job_workflow_ref?: string;
}

/**
 * Verifies a GitHub OIDC token and returns its claims
 * @param token The JWT token from GitHub Actions
 * @returns Decoded and verified token claims
 * @throws {AuthError} If token verification fails
 */
export async function verifyGitHubOidcToken(token: string): Promise<GitHubOidcClaims> {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['RS256']
    });

    // Type assertion since we know the shape of the payload
    return payload as unknown as GitHubOidcClaims;
  } catch (error) {
    if (error instanceof Error) {
      throw new AuthError(
        `GitHub OIDC token verification failed: ${error.message}`,
        'GITHUB_OIDC_VERIFICATION_FAILED',
        401,
        { cause: error }
      );
    }
    
    throw new AuthError(
      'GitHub OIDC token verification failed',
      'GITHUB_OIDC_VERIFICATION_FAILED',
      401
    );
  }
}

/**
 * Middleware to protect routes with GitHub OIDC authentication
 */
export function withGitHubOidc(handler: (req: Request, claims: GitHubOidcClaims) => Promise<Response>) {
  return async (req: Request) => {
    try {
      const authHeader = req.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ 
            error: 'Missing or invalid authorization header',
            code: 'MISSING_AUTH_HEADER' 
          }), 
          { 
            status: 401,
            headers: { 
              'Content-Type': 'application/json',
              'WWW-Authenticate': 'Bearer error="invalid_token", error_description="Missing or invalid authorization header"'
            }
          }
        );
      }

      const token = authHeader.split(' ')[1];
      const claims = await verifyGitHubOidcToken(token);
      
      return handler(req, claims);
      
    } catch (error) {
      if (error instanceof AuthError) {
        return new Response(
          JSON.stringify({ 
            error: error.message,
            code: error.code 
          }), 
          { 
            status: error.status,
            headers: { 
              'Content-Type': 'application/json',
              'WWW-Authenticate': `Bearer error="${error.code}", error_description="${error.message}"`
            }
          }
        );
      }
      
      console.error('GitHub OIDC verification error:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Internal server error',
          code: 'INTERNAL_SERVER_ERROR' 
        }), 
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  };
}
