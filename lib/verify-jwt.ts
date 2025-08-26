import { auth } from '@clerk/nextjs/server';
import jwt, { JwtPayload as BaseJwtPayload } from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

export type TokenType = 'github' | 'clerk';

// Constants
export const GITHUB_ISSUER = 'https://token.actions.githubusercontent.com';
const CLERK_ISSUER = process.env.CLERK_JWT_ISSUER || 'clerk.clerko.v1';
const GITHUB_JWKS_URI = `${GITHUB_ISSUER}/.well-known/jwks`;

// Interfaces
export interface GitHubTokenPayload extends jwt.JwtPayload {
  repository?: string;
  repository_owner?: string;
  job_workflow_ref?: string;
  ref?: string;
  workflow?: string;
  actor?: string;
  run_id?: string;
  event_name?: string;
}

export interface VerifyRequestResult {
  type: TokenType;
  userId?: string;
  repository?: string;
  workflow?: string;
  runId?: string;
  actor?: string;
  ref?: string;
}

// Configure GitHub JWKS client
const githubJwksClient = jwksClient({
  jwksUri: GITHUB_JWKS_URI,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
  timeout: 10000, // 10 seconds
});

// Configure JWKS clients with caching and rate limiting
const clients = {
  github: jwksClient({
    jwksUri: `${GITHUB_ISSUER}/.well-known/jwks`,
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 10,
    timeout: 10000, // 10 seconds
  }),
  clerk: jwksClient({
    jwksUri: process.env.CLERK_JWKS_URL || `https://${CLERK_ISSUER}/.well-known/jwks.json`,
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 10,
    timeout: 10000,
  })
};

// Cache for public keys to reduce JWKS lookups
const keyCache = new Map<string, string>();

// Extend base JwtPayload with our custom fields
export interface JwtPayload extends BaseJwtPayload {
  tokenType: TokenType;
  // GitHub specific fields
  repository?: string;
  repository_owner?: string;
  job_workflow_ref?: string;
  workflow?: string;
  actor?: string;
  run_id?: string;
  ref?: string;
  // Clerk specific fields
  userId?: string;
}

async function getKey(header: jwt.JwtHeader, tokenType: TokenType): Promise<string> {
  if (!header.kid) {
    throw new Error('No key ID (kid) found in token header');
  }

  const cacheKey = `${tokenType}:${header.kid}`;
  
  // Return cached key if available
  if (keyCache.has(cacheKey)) {
    return keyCache.get(cacheKey)!;
  }

  try {
    const client = clients[tokenType];
    const key = await client.getSigningKey(header.kid);
    const publicKey = key.getPublicKey();
    
    // Cache the key
    keyCache.set(cacheKey, publicKey);
    
    return publicKey;
  } catch (error) {
    throw new Error(`Failed to retrieve public key: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function isGitHubToken(issuer: string | undefined): boolean {
  return issuer?.startsWith(GITHUB_ISSUER) || false;
}

export async function verifyJwt(token: string): Promise<JwtPayload> {
  if (!token) {
    throw new Error('No token provided');
  }

  // First, decode without verification to get the header and basic info
  const decodedHeader = jwt.decode(token, { complete: true });
  if (!decodedHeader || !decodedHeader.header || !decodedHeader.payload) {
    throw new Error('Invalid token: Could not decode token');
  }

  // Get the payload safely
  const payload = typeof decodedHeader.payload === 'string' 
    ? JSON.parse(decodedHeader.payload) 
    : decodedHeader.payload;

  // Validate required fields
  if (!payload.iss || !payload.sub || !payload.aud) {
    throw new Error('Invalid token: Missing required fields (iss, sub, or aud)');
  }

  // Determine token type based on issuer
  const tokenType: TokenType = isGitHubToken(payload.iss) ? 'github' : 'clerk';
  
  try {
    // Get the appropriate public key
    const key = await getKey(decodedHeader.header, tokenType);
    
    // Verify the token
    const decoded = jwt.verify(token, key, {
      algorithms: ["RS256"],
      issuer: tokenType === 'github' ? GITHUB_ISSUER : CLERK_ISSUER,
      audience: tokenType === 'github' 
        ? process.env.GITHUB_ACTIONS_OIDC_AUDIENCE 
        : process.env.CLERK_JWT_AUDIENCE,
      clockTolerance: 30, // 30 seconds leeway for clock skew
    });

    // Type guard to ensure we have a proper JwtPayload
    if (typeof decoded === 'string' || !decoded.sub || !decoded.iss) {
      throw new Error('Invalid token: Malformed payload');
    }

    // Add token type and ensure proper typing
    const typedPayload: JwtPayload = {
      ...decoded,
      tokenType,
      sub: decoded.sub,
      iss: decoded.iss,
      aud: decoded.aud,
      exp: decoded.exp!,
      iat: decoded.iat!,
    } as JwtPayload;

    // Additional validation based on token type
    if (tokenType === 'github') {
      if (!('repository' in typedPayload) || !typedPayload.repository) {
        throw new Error('GitHub token is missing required repository claim');
      }
    } else if (tokenType === 'clerk') {
      if (!('userId' in typedPayload) || !typedPayload.userId) {
        throw new Error('Clerk token is missing required userId claim');
      }
    }

    return typedPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error(`Invalid token: ${error.message}`);
    } else if (error instanceof jwt.NotBeforeError) {
      throw new Error(`Token not yet valid: ${error.message}`);
    }
    throw new Error(`Failed to verify token: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper function to extract token from Authorization header
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return null;
  }
  return authHeader.split(' ')[1] || null;
}

export interface VerifyRequestResult {
  type: TokenType;
  userId?: string;
  repository?: string;
  workflow?: string;
  runId?: string;
  actor?: string;
  ref?: string;
}

export async function verifyRequest(request: Request): Promise<VerifyRequestResult> {
  const authHeader = request.headers.get('authorization');
  const token = extractToken(authHeader);

  if (!token) {
    throw new Error('No authorization token provided');
  }

  try {
    const payload = await verifyJwt(token);
    
    if (payload.tokenType === 'github') {
      // Type assertion for GitHub token
      const githubPayload = payload as JwtPayload & {
        repository?: string;
        repository_owner?: string;
        job_workflow_ref?: string;
        workflow?: string;
        actor?: string;
        run_id?: string;
        ref?: string;
      };

      return {
        type: 'github',
        repository: githubPayload.repository || githubPayload.repository_owner,
        workflow: githubPayload.workflow || githubPayload.job_workflow_ref,
        runId: githubPayload.run_id,
        actor: githubPayload.actor,
        ref: githubPayload.ref,
      };
    } else {
      // Type assertion for Clerk token
      const clerkPayload = payload as JwtPayload & { userId?: string };
      if (!clerkPayload.userId) {
        throw new Error('Clerk token is missing required userId claim');
      }
      return {
        type: 'clerk',
        userId: clerkPayload.userId,
      };
    }
  } catch (error) {
    console.error('Authentication error:', error);
    throw new Error(
      error instanceof Error 
        ? `Authentication failed: ${error.message}` 
        : 'Authentication failed: Unknown error'
    );
  }
}
