// lib/middleware/withGithubOidc.ts
import { NextResponse } from 'next/server'
import { verifyGithubOidc, OidcAuthError, GithubOidcClaims } from '../auth/verifyGithubOidc'

export type AuthedRequest = Request & { claims: GithubOidcClaims }

/**
 * Middleware that verifies GitHub OIDC tokens and bypasses Clerk authentication
 * for GitHub Actions workflows.
 */
export function withGithubOidc(
  handler: (req: AuthedRequest) => Promise<Response> | Response,
) {
  return async (req: Request): Promise<Response> => {
    try {
      // Get Authorization header
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'missing_or_malformed_authorization' },
          { status: 401 },
        )
      }
      
      // Extract and verify token
      const token = authHeader.substring('Bearer '.length).trim()
      const claims = await verifyGithubOidc(token, {
        audience: process.env.GHA_OIDC_AUDIENCE,
        allowedRepo: process.env.GHA_ALLOWED_REPO,
        allowedRef: process.env.GHA_ALLOWED_REF,
      })

      // Create authenticated request with claims
      const authedReq: AuthedRequest = Object.assign(new Request(req), { claims })
      return await handler(authedReq)
      
    } catch (err: any) {
      console.error('GitHub OIDC verification failed:', err)
      
      if (err instanceof OidcAuthError) {
        return NextResponse.json(
          { 
            error: 'github_oidc_error',
            code: err.code,
            message: err.message 
          },
          { status: err.status },
        )
      }
      
      return NextResponse.json(
        { 
          error: 'internal_error',
          message: 'An unexpected error occurred while verifying GitHub OIDC token' 
        },
        { status: 500 },
      )
    }
  }
}
