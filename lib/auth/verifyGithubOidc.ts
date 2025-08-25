import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose'

// GitHub OIDC constants
const DEFAULT_ISSUER = 'https://token.actions.githubusercontent.com'
const DEFAULT_JWKS_URL = 'https://token.actions.githubusercontent.com/.well-known/jwks'

// Cached JWKS instance
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

// Helper to create a proper JWKS client
async function createCustomJWKSClient(url: string): Promise<ReturnType<typeof createRemoteJWKSet>> {
  const baseClient = createRemoteJWKSet(new URL(url), {
    cooldownDuration: 60_000,
    timeoutDuration: 10_000,
  });

  // Create a wrapper function that adds our custom key selection logic
  const client = async (protectedHeader: any, token: any): Promise<CryptoKey> => {
    try {
      // First try to find a key using the kid from the token header
      if (protectedHeader?.kid) {
        try {
          // Fetch all keys
          const response = await fetch(url);
          const { keys } = await response.json();
          
          // Find a key that matches our criteria
          const matchingKey = keys.find((k: any) => 
            k.kid === protectedHeader.kid &&
            k.kty === 'RSA' &&
            k.alg === 'RS256' &&
            k.use === 'sig'
          );

          if (matchingKey) {
            // Create a new header with only the matching key ID
            const specificHeader = { ...protectedHeader, kid: matchingKey.kid };
            return baseClient(specificHeader, token);
          }
        } catch (error) {
          console.error('Error in custom key selection:', error);
          // Fall through to default behavior
        }
      }
      
      // Fall back to default behavior if no matching key found or if there was an error
      return baseClient(protectedHeader, token);
    } catch (error) {
      console.error('Error in JWKS client:', error);
      throw error;
    }
  };

  // Copy all properties from baseClient to our client
  return Object.assign(client, baseClient);
}

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

async function getJwks(): Promise<ReturnType<typeof createRemoteJWKSet>> {
  if (!jwks) {
    // Always use the production GitHub OIDC JWKS endpoint
    const jwksUrl = 'https://token.actions.githubusercontent.com/.well-known/jwks';
    console.log('Initializing JWKS client with URL:', jwksUrl);
    
    try {
      jwks = await createCustomJWKSClient(jwksUrl);
      console.log('JWKS client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize JWKS client:', error);
      throw new OidcAuthError(500, 'jwks_init_failed', 'Failed to initialize JWKS client');
    }
  }
  
  if (!jwks) {
    throw new OidcAuthError(500, 'jwks_not_initialized', 'JWKS client not initialized');
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
    // Get the JWKS client
    const jwksClient = await getJwks();
    
    // Verify the token with the JWKS client
    const { payload, protectedHeader } = await jwtVerify(token, jwksClient, {
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
