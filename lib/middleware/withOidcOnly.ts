import { NextRequest, NextResponse } from 'next/server';
import { verifyGithubOidc } from '../auth/github-oidc';
import { logger } from '../logger';

// Types for the handler function
type Handler<T = any> = (
  req: NextRequest,
  params: T,
  oidcClaims: any
) => Promise<NextResponse> | NextResponse | Promise<Response> | Response;

/**
 * Middleware that verifies GitHub OIDC token
 */
export function withOidcOnly<T = any>(
  handler: Handler<T>
) {
  return async (req: NextRequest, params: T): Promise<Response> => {
    try {
      // Get the authorization header
      const authHeader = req.headers.get('authorization');
      
      if (!authHeader) {
        logger.warn('Missing authorization header');
        return NextResponse.json(
          { error: 'Unauthorized: Missing authorization header', code: 'MISSING_AUTH_HEADER' },
          { status: 401 }
        );
      }

      // Extract the token
      const token = authHeader.replace(/^Bearer\s+/i, '');
      
      if (!token) {
        logger.warn('Missing bearer token');
        return NextResponse.json(
          { error: 'Unauthorized: Missing token', code: 'MISSING_TOKEN' },
          { status: 401 }
        );
      }

      // Verify the OIDC token
      const claims = await verifyGithubOidc(token);
      
      // Call the handler with the claims
      return await handler(req, params, claims);
      
    } catch (error: any) {
      logger.error('OIDC verification failed:', { error });
      
      if (error.code === 'ERR_JWT_EXPIRED') {
        return NextResponse.json(
          { error: 'Token expired', code: 'TOKEN_EXPIRED' },
          { status: 401 }
        );
      }
      
      if (error.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
        return NextResponse.json(
          { error: 'Invalid token signature', code: 'INVALID_SIGNATURE' },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token', code: 'INVALID_TOKEN' },
        { status: 401 }
      );
    }
  };
}
