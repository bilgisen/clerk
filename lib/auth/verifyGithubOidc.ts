import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose'

// Check if we're running in an Edge Runtime environment
const isEdgeRuntime = 
  (typeof process !== 'undefined' && 
   typeof process.env !== 'undefined' && 
   process.env.NEXT_RUNTIME === 'edge');

// GitHub OIDC constants
const DEFAULT_ISSUER = 'https://token.actions.githubusercontent.com'
const DEFAULT_JWKS_URL = 'https://token.actions.githubusercontent.com/.well-known/jwks'

// Cached JWKS instance
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

// Helper to create a proper JWKS client for GitHub OIDC
async function createCustomJWKSClient(): Promise<ReturnType<typeof createRemoteJWKSet>> {
  const jwksUrl = 'https://token.actions.githubusercontent.com/.well-known/jwks';
  
  // Create a custom JWKS client with appropriate settings for the runtime
  const client = createRemoteJWKSet(new URL(jwksUrl), {
    cooldownDuration: 0, // Disable cooldown to always check for fresh keys
    timeoutDuration: 10_000,
    // In Edge Runtime, we can't use a custom agent, but we can still use the global fetch
    // The global fetch in Edge Runtime already has good defaults
  });

  // Create a wrapper that handles the key selection more flexibly
  const handler = async (protectedHeader: any, token: any): Promise<CryptoKey> => {
    try {
      console.log('Attempting to verify token with header:', JSON.stringify(protectedHeader, null, 2));
      
      // First try with the original handler
      try {
        return await (client as any)(protectedHeader, token);
      } catch (firstError) {
        console.warn('First verification attempt failed, trying alternative approach:', firstError);
        
        // If that fails, try fetching the keys directly
        const fetchOptions: RequestInit = {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'clerko/1.0.0'
          },
          // In Edge Runtime, we can't set a custom agent
          // but the global fetch will handle HTTPS properly
        };
        
        const response = await fetch(jwksUrl, fetchOptions);
        if (!response.ok) {
          throw new Error(`Failed to fetch JWKS: ${response.status} ${response.statusText}`);
        }
        
        const { keys } = await response.json();
        
        console.log(`Fetched ${keys.length} keys from JWKS endpoint`);
        
        // Try each key that matches our criteria
        const matchingKeys = keys.filter((k: any) => 
          k.kty === 'RSA' && 
          k.alg === 'RS256' &&
          k.use === 'sig' &&
          (!protectedHeader?.kid || k.kid === protectedHeader.kid)
        );
        
        console.log(`Found ${matchingKeys.length} matching keys`);
        
        if (matchingKeys.length === 0) {
          throw new Error('No matching keys found in JWKS set');
        }
        
        // Try each matching key
        for (const key of matchingKeys) {
          try {
            console.log(`Trying key with kid: ${key.kid}`);
            const result = await (client as any)({ ...protectedHeader, kid: key.kid }, token);
            console.log('Successfully verified with key:', key.kid);
            return result;
          } catch (keyError) {
            console.warn(`Failed to verify with key ${key.kid}:`, (keyError as Error).message);
            // Continue to next key
          }
        }
        
        throw new Error('All key verification attempts failed');
      }
    } catch (error) {
      console.error('Error in JWKS verification:', error);
      throw error;
    }
  };
  
  // Copy all properties from the original client
  return Object.assign(handler, client);
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
    try {
      jwks = await createCustomJWKSClient();
      console.log('GitHub OIDC JWKS client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize GitHub OIDC JWKS client:', error);
      throw new OidcAuthError(
        500, 
        'jwks_init_failed', 
        'Failed to initialize GitHub OIDC JWKS client: ' + (error as Error).message
      );
    }
  }
  
  if (!jwks) {
    throw new OidcAuthError(500, 'jwks_not_initialized', 'GitHub OIDC JWKS client not initialized');
  }
  
  return jwks;
}

export async function verifyGithubOidc(token: string, opts?: OidcVerificationOptions): Promise<GithubOidcClaims> {
  if (!token) {
    throw new OidcAuthError(401, 'missing_token', 'Authorization token is required');
  }

  // Get the JWKS client
  const jwks = await getJwks();
  
  // Get issuer from environment or use default
  const issuer = getEnv('GITHUB_OIDC_ISSUER', DEFAULT_ISSUER);
  const audience = opts?.audience || getEnv('GITHUB_OIDC_AUDIENCE');

  if (!audience) {
    throw new OidcAuthError(401, 'missing_audience', 'Audience is required');
  }

  try {
    console.log(`Verifying GitHub OIDC token with issuer: ${issuer}, audience: ${audience}`);
    
    // Verify the token with the JWKS client
    const { payload, protectedHeader } = await jwtVerify(token, jwks, {
      issuer,
      audience: [audience], // Support array of audiences
      algorithms: ['RS256'],
      clockTolerance: opts?.clockToleranceSec ?? 60, // small skew
    });

    console.log('Token verified successfully, protected header:', JSON.stringify(protectedHeader, null, 2));

    if (!protectedHeader.kid) {
      throw new OidcAuthError(401, 'missing_kid', 'Token header missing kid');
    }

    // Type assertion to access custom claims
    const claims = payload as GithubOidcClaims;
    console.log('Token claims:', JSON.stringify(claims, null, 2));

    // Validate repository if specified
    if (opts?.allowedRepo) {
      const [owner, repo] = opts.allowedRepo.split('/');
      if (claims.repository_owner !== owner || claims.repository !== repo) {
        throw new OidcAuthError(
          403, 
          'invalid_repository', 
          `Repository ${claims.repository_owner}/${claims.repository} does not match allowed repository ${opts.allowedRepo}`
        );
      }
    }

    // Validate ref if specified
    if (opts?.allowedRef) {
      const ref = `refs/heads/${opts.allowedRef}`;
      if (claims.ref !== ref) {
        throw new OidcAuthError(
          403, 
          'invalid_ref', 
          `Ref ${claims.ref} does not match allowed ref ${ref}`
        );
      }
    }

    // Validate workflow if specified
    if (opts?.allowedWorkflow && claims.workflow !== opts.allowedWorkflow) {
      throw new OidcAuthError(
        403, 
        'invalid_workflow', 
        `Workflow ${claims.workflow} does not match allowed workflow ${opts.allowedWorkflow}`
      );
    }

    return claims;
  } catch (error) {
    console.error('GitHub OIDC verification failed:', error);
    
    if (error instanceof OidcAuthError) {
      throw error;
    }
    
    // Handle specific JWT errors
    if (error instanceof Error) {
      if ('code' in error) {
        const code = (error as any).code;
        if (code === 'ERR_JWKS_NO_MATCHING_KEY') {
          console.error('JWKS key not found - this usually means the token was issued by a different identity provider');
          throw new OidcAuthError(
            401, 
            'invalid_token', 
            'No matching key found in the JSON Web Key Set. The token might be from a different identity provider.'
          );
        } else if (code === 'ERR_JWT_EXPIRED') {
          throw new OidcAuthError(401, 'token_expired', 'Token has expired');
        } else if (code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
          throw new OidcAuthError(401, 'invalid_claims', 'Invalid token claims');
        } else if (code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
          throw new OidcAuthError(401, 'invalid_signature', 'Invalid token signature');
        }
      }
      
      // Fallback error handling
      if (error.message.includes('JWTExpired')) {
        throw new OidcAuthError(401, 'token_expired', 'Token has expired');
      }
      
      if (error.message.includes('JWSInvalid') || error.message.includes('JWSSignatureVerificationFailed')) {
        throw new OidcAuthError(401, 'invalid_signature', 'Invalid token signature');
      }
    }

    // Default error
    throw new OidcAuthError(
      401, 
      'invalid_token', 
      `Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
