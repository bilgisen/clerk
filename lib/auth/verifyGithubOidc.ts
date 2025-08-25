import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose'

// GitHub OIDC constants
const DEFAULT_ISSUER = 'https://token.actions.githubusercontent.com'
const DEFAULT_JWKS_URL = 'https://token.actions.githubusercontent.com/.well-known/jwks'

// Cached JWKS instance
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

export type OidcVerificationOptions = {
  audience?: string
  allowedRepo?: string
  allowedRef?: string
  allowedWorkflow?: string
  clockToleranceSec?: number
}

export type GithubOidcClaims = JWTPayload & {
  // Common GitHub OIDC claims
  repository?: string
  ref?: string
  workflow?: string
  // Others you may use: job_workflow_ref, repository_id, actor, environment, run_id
}

export class OidcAuthError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

function getEnv(name: string, fallback?: string): string | undefined {
  const v = process.env[name]
  return v && v.length > 0 ? v : fallback
}

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!jwks) {
    // Always use the production GitHub OIDC JWKS endpoint
    const url = new URL('https://token.actions.githubusercontent.com/.well-known/jwks');
    
    console.log('Initializing JWKS client with URL:', url.toString());
    
    jwks = createRemoteJWKSet(url, {
      cooldownDuration: 60_000, // 60s
      timeoutDuration: 10_000, // Increased timeout to 10s
    });
    
    // Test the JWKS fetch immediately with proper typing
    const testKey = jwks({ alg: 'RS256' }, {} as any);
    if (testKey instanceof Promise) {
      testKey
        .then(() => {
          console.log('Successfully fetched JWKS keys');
        })
        .catch((err: Error) => {
          console.error('Failed to fetch JWKS keys:', err);
        });
    }
  }
  return jwks;
}

export async function verifyGithubOidc(token: string, opts?: OidcVerificationOptions): Promise<GithubOidcClaims> {
  if (!token) {
    throw new OidcAuthError(401, 'missing_token', 'Authorization token is required')
  }

  // Always use the production GitHub OIDC issuer for token verification
  const issuer = 'https://token.actions.githubusercontent.com';
  const audience = opts?.audience ?? getEnv('GHA_OIDC_AUDIENCE');
  
  if (!audience) {
    throw new OidcAuthError(500, 'server_config', 'GHA_OIDC_AUDIENCE is not configured')
  }

  try {
    const { payload, protectedHeader } = await jwtVerify(token, getJwks(), {
      issuer,
      audience,
      algorithms: ['RS256'],
      clockTolerance: opts?.clockToleranceSec ?? 60, // small skew
    })

    if (!protectedHeader.kid) {
      throw new OidcAuthError(401, 'missing_kid', 'Token header missing kid')
    }

    const claims = payload as GithubOidcClaims

    // Strict allowlist checks
    const allowedRepo = opts?.allowedRepo ?? getEnv('GHA_ALLOWED_REPO')
    if (allowedRepo && claims.repository !== allowedRepo) {
      throw new OidcAuthError(403, 'repo_denied', `Repository not allowed: ${claims.repository}`)
    }

    const allowedRef = opts?.allowedRef ?? getEnv('GHA_ALLOWED_REF')
    if (allowedRef && claims.ref !== allowedRef) {
      throw new OidcAuthError(403, 'ref_denied', `Ref not allowed: ${claims.ref}`)
    }

    const allowedWorkflow = opts?.allowedWorkflow ?? getEnv('GHA_ALLOWED_WORKFLOW')
    if (allowedWorkflow && claims.workflow !== allowedWorkflow) {
      throw new OidcAuthError(403, 'workflow_denied', `Workflow not allowed: ${claims.workflow}`)
    }

    return claims
  } catch (err: any) {
    console.error('OIDC verification failed:', {
      name: err?.name,
      message: err?.message,
      code: err?.code,
      stack: err?.stack,
    });
    
    if (err instanceof OidcAuthError) throw err;
    
    // Map jose errors to HTTP-friendly ones
    const msg = typeof err?.message === 'string' ? err.message : 'verification failed';
    
    // More specific error handling
    let status = 403;
    if (msg.includes('no applicable key found in the JSON Web Key Set')) {
      status = 401;
      console.error('JWKS key not found - this usually means the token was issued by a different identity provider');
    } else if (/audience|issuer|signature|expired|not active/i.test(msg)) {
      status = 401;
    }
    
    throw new OidcAuthError(status, 'invalid_token', msg);
  }
}
