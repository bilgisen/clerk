import { NextResponse } from 'next/server'
import { verifyGithubOidc, OidcAuthError, GithubOidcClaims } from '../auth/verifyGithubOidc'

export type AuthedRequest = Request & { claims?: GithubOidcClaims }

export function withGithubOidc(
  handler: (req: AuthedRequest) => Promise<Response> | Response,
) {
  return async (req: Request): Promise<Response> => {
    try {
      const auth = req.headers.get('authorization') || req.headers.get('Authorization')
      if (!auth || !auth.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'missing_or_malformed_authorization' },
          { status: 401 },
        )
      }
      const token = auth.substring('Bearer '.length).trim()
      const claims = await verifyGithubOidc(token)

      const authedReq: AuthedRequest = Object.assign(new Request(req), { claims })
      return await handler(authedReq)
    } catch (err: any) {
      if (err instanceof OidcAuthError) {
        return NextResponse.json(
          { error: err.code, message: err.message },
          { status: err.status },
        )
      }
      return NextResponse.json(
        { error: 'internal_error' },
        { status: 500 },
      )
    }
  }
}
