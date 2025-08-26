// lib/auth/verifyGithubOidc.ts
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
        
        const json = await response.json();
        const keys = json.keys || [];
        
        console.log(`Fetched ${keys.length} keys from JWKS endpoint`);
        console.debug('All JWKS keys:', JSON.stringify(keys, null, 2));
        
        if (!protectedHeader?.kid) {
          console.warn('No kid in JWT header, will try all available keys');
        } else {
          console.log(`Looking for key with kid: ${protectedHeader.kid}`);
        }
        
        // Try each key that matches our criteria
        const matchingKeys = keys.filter((k: any) => {
          const matches = 
            k.kty === 'RSA' && 
            k.alg === 'RS256' &&
            k.use === 'sig' &&
            (!protectedHeader?.kid || k.kid === protectedHeader.kid);
          
          console.log(`Key ${k.kid} matches criteria: ${matches}`);
          return matches;
        });
        
        console.log(`Found ${matchingKeys.length} matching keys`);
        
        if (matchingKeys.length === 0) {
          const availableKids = keys.map((k: any) => k.kid).filter(Boolean);
          throw new Error(
            'No matching keys found in JWKS set. ' +
            `Expected kid: ${protectedHeader?.kid || 'any'}, ` +
            `Available kids: ${availableKids.join(', ') || 'none'}`
          );
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

export interface VerifyGithubOidcOptions {
  audience?: string | string[];
  allowedRepo?: string | RegExp;
  allowedRef?: string | RegExp;
  allowedWorkflow?: string | RegExp;
  clockToleranceSec?: number;
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

// Function to check if a token is likely a GitHub OIDC token
function isGitHubOidcToken(token: string): boolean {
  try {
    // GitHub OIDC tokens are JWTs with a specific structure
    const parts = token.split('.'); 
    if (parts.length !== 3) return false;
    
    const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
    // GitHub OIDC tokens use RS256
    return header.alg === 'RS256' && header.typ === 'JWT';
  } catch {
    return false;
  }
}

export async function verifyGithubOidc(token: string, opts: VerifyGithubOidcOptions = {}): Promise<GithubOidcClaims> {
  if (!token) {
    throw new OidcAuthError(401, 'missing_token', 'Authorization token is required');
  }

  // First check if this looks like a GitHub OIDC token
  if (!isGitHubOidcToken(token)) {
    throw new OidcAuthError(401, 'INVALID_TOKEN_FORMAT', 'Invalid token format - not a GitHub OIDC token');
  }

  // Get the JWKS client
  const jwksClient = await getJwks();
  const issuer = process.env.GITHUB_OIDC_ISSUER || DEFAULT_ISSUER;
  const audience = opts?.audience || process.env.GITHUB_OIDC_AUDIENCE;
  
  console.log('Verifying JWT with:', {
    issuer,
    audience,
    jwksUrl: process.env.GITHUB_OIDC_JWKS_URL || DEFAULT_JWKS_URL
  });
  
  // Decode the JWT header first to get the kid
  const [headerBase64] = token.split('.');
  const header = JSON.parse(Buffer.from(headerBase64, 'base64').toString());
  console.log('JWT Header:', JSON.stringify(header, null, 2));
  
  async function validateTokenWithJwks(jwksClient: ReturnType<typeof createRemoteJWKSet>) {
    try {
      const { payload, protectedHeader } = await jwtVerify(token, jwksClient, {
        issuer,
        audience,
        algorithms: ['RS256'],
        clockTolerance: opts.clockToleranceSec ?? 60,
      });

      console.log('Token verified successfully');
      console.log('Token header:', JSON.stringify(protectedHeader, null, 2));
      
      if (!protectedHeader.kid) {
        throw new OidcAuthError(401, 'missing_kid', 'Token header missing kid');
      }

      // Type assertion to access custom claims
      const claims = payload as GithubOidcClaims;
      console.log('Token claims:', JSON.stringify(claims, null, 2));
      
      // Validate repository if specified
      if (opts.allowedRepo) {
        const repo = typeof opts.allowedRepo === 'string' ? opts.allowedRepo : opts.allowedRepo.toString();
        const [owner, repoName] = repo.split('/');
        if (claims.repository_owner !== owner || claims.repository !== repoName) {
          throw new OidcAuthError(
            403, 
            'invalid_repository', 
            `Repository ${claims.repository_owner}/${claims.repository} does not match allowed repository ${repo}`
          );
        }
      }
      
      // Validate ref if specified
      if (opts.allowedRef) {
        const ref = typeof opts.allowedRef === 'string' ? opts.allowedRef : opts.allowedRef.toString();
        const expectedRef = `refs/heads/${ref}`;
        if (claims.ref !== expectedRef) {
          throw new OidcAuthError(
            403, 
            'invalid_ref', 
            `Ref ${claims.ref} does not match allowed ref ${expectedRef}`
          );
        }
      }

      // Validate workflow if specified
      if (opts.allowedWorkflow && claims.workflow !== opts.allowedWorkflow) {
        throw new OidcAuthError(
          403, 
          'invalid_workflow', 
          `Workflow ${claims.workflow} does not match allowed workflow ${opts.allowedWorkflow}`
        );
      }

      return claims;
    } catch (error) {
      console.error('Token validation failed:', error);
      throw error;
    }
  }
  
  try {
    // First try with the cached JWKS client
    return await validateTokenWithJwks(jwksClient);
  } catch (firstError: any) {
    // If verification fails, try refreshing the JWKS once
    if (firstError.code === 'ERR_JWKS_NO_MATCHING_KEY' || 
        firstError.code === 'ERR_JWKS_MULTIPLE_MATCHING_KEYS') {
      console.log('Key not found in cached JWKS, refreshing...');
      const freshClient = await createCustomJWKSClient();
      try {
        return await validateTokenWithJwks(freshClient);
      } catch (secondError: any) {
        console.error('Token verification failed after JWKS refresh:', secondError);
        
        // Handle specific JWT verification errors
        if (secondError.code === 'ERR_JWS_INVALID' || 
            secondError.message?.includes('JWSInvalid') || 
            secondError.message?.includes('JWSSignatureVerificationFailed')) {
          throw new OidcAuthError(
            401,
            'INVALID_SIGNATURE',
            'Invalid token signature - this appears to be a Clerk token, not a GitHub OIDC token'
          );
        } else if (secondError.code === 'ERR_JWT_EXPIRED' || secondError.message?.includes('JWTExpired')) {
          throw new OidcAuthError(401, 'TOKEN_EXPIRED', 'Token has expired');
        } else if (secondError.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
          throw new OidcAuthError(401, 'INVALID_CLAIMS', 'Invalid token claims');
        } else if (secondError.code === 'ERR_JWKS_NO_MATCHING_KEY') {
          throw new OidcAuthError(
            401,
            'INVALID_TOKEN',
            'No matching key found in the JSON Web Key Set. The token might be from a different identity provider.'
          );
        } else if (secondError.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
          throw new OidcAuthError(401, 'INVALID_SIGNATURE', 'Invalid token signature');
        }
        
        // For any other error, rethrow with a generic message
        throw new OidcAuthError(
          401,
          'TOKEN_VERIFICATION_FAILED',
          'Failed to verify token: ' + (secondError.message || 'Unknown error')
        );
      }
    } else {
      // If the error wasn't a key mismatch, rethrow the original error
      throw firstError;
    }
  }
}
