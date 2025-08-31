import { auth } from '@clerk/nextjs/server';
import type { User } from '@clerk/nextjs/dist/types/server';

const clerkAuth = auth;
import * as jose from 'jose';

export interface GitHubOidcClaims extends jose.JWTPayload {
  sub: string;
  repository?: string;
  repository_owner?: string;
  workflow?: string;
  environment?: string;
  job_workflow_ref?: string;
  ref?: string;
  sha?: string;
  actor?: string;
  run_id?: string;
  run_number?: string;
  run_attempt?: string;
  head_ref?: string;
  base_ref?: string;
  event_name?: string;
  ref_type?: string;
  [key: string]: unknown;
}

export interface GitHubOidcAuthContext {
  type: 'github-oidc';
  userId: string;
  repository: string;
  run_id: string;
  workflow: string;
  claims: GitHubOidcClaims;
}

export async function verifyGitHubOidcToken(token: string): Promise<{
  valid: boolean;
  claims?: GitHubOidcClaims;
  error?: string;
}> {
  try {
    // In a real implementation, you would verify the JWT with GitHub's OIDC provider
    // This is a simplified example
    // Replace with actual verification logic against GitHub's OIDC provider
    
    // Example verification (pseudo-code):
    // 1. Get GitHub's OIDC public keys
    // 2. Verify the JWT signature
    // 3. Verify the token claims (issuer, audience, expiration, etc.)
    
    // For now, we'll simulate a successful verification
    const claims: GitHubOidcClaims = {
      sub: 'repo:owner/repo:environment:production',
      repository: 'owner/repo',
      repository_owner: 'owner',
      workflow: 'deploy',
      run_id: '12345',
      // Add other claims as needed
    };
    
    return {
      valid: true,
      claims
    };
  } catch (error) {
    console.error('Error verifying GitHub OIDC token:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Token verification failed'
    };
  }
}

export async function getGitHubOidcContext(): Promise<GitHubOidcAuthContext | null> {
  try {
    // Get the Clerk session
    const session = await clerkAuth();
    
    if (!session?.sessionId) {
      console.error('No active session found');
      return null;
    }
    
    // Get the token from the session
    const token = await session.getToken();
    
    if (!token) {
      console.error('No token found in session');
      return null;
    }
    
    // Verify the GitHub OIDC token
    const verification = await verifyGitHubOidcToken(token);
    
    // Check if verification was successful
    if (!verification.valid || !verification.claims) {
      console.error('Invalid GitHub OIDC token:', verification.error);
      return null;
    }
    
    const { claims } = verification;
    
    // Validate required claims
    if (!claims.repository || !claims.run_id) {
      console.error('Missing required claims in GitHub OIDC token');
      return null;
    }
    
    // Return the authentication context
    return {
      type: 'github-oidc',
      userId: session.userId || '',
      repository: claims.repository,
      run_id: claims.run_id,
      workflow: claims.workflow || 'unknown',
      claims: claims
    };
  } catch (error) {
    console.error('Error in getGitHubOidcContext:', error);
    return null;
  }
}
