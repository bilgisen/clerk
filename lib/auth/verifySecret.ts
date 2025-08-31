import { NextRequest } from 'next/server';

/**
 * Verifies the secret token from the request headers
 * @param request The incoming request object
 * @returns boolean indicating if the token is valid
 */
export function verifySecretToken(request: NextRequest | { headers: { get: (name: string) => string | null } }): boolean {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.split(' ')[1]; // Get the token part after 'Bearer '
  
  if (!token) {
    console.error('No token provided');
    return false;
  }

  const secret = process.env.GT_PAYLOAD_SECRET;
  if (!secret) {
    console.error('GT_PAYLOAD_SECRET is not set');
    return false;
  }

  return token === secret;
}
