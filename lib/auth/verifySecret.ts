import { NextRequest } from 'next/server';

// Hardcoded to match the new token format without special characters
const HARDCODED_SECRET = 'PAYLOAD_71y15GYgRYGMe16a4';

/**
 * Verifies the request using the secret token
 * @param req Next.js request object
 * @returns boolean indicating if the request is authenticated
 */
export async function verifySecretToken(req: NextRequest): Promise<boolean> {
  console.log('Using hardcoded secret for verification');
  
  if (!HARDCODED_SECRET) {
    console.error('Secret token is not configured');
    return false;
  }

  // Get the Authorization header
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader) {
    console.error('No Authorization header found');
    return false;
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    console.error('Authorization header does not start with Bearer');
    return false;
  }

  try {
    const token = authHeader.split(' ')[1]?.trim();
    if (!token) {
      console.error('No token found in Authorization header');
      return false;
    }

    // Check if token starts with PAYLOAD_
    if (!token.startsWith('PAYLOAD_')) {
      console.error('Token does not start with PAYLOAD_ prefix');
      return false;
    }
    
    // Simple comparison with the hardcoded secret
    const isValid = token === HARDCODED_SECRET;
    
    if (!isValid) {
      console.error('Token does not match');
      console.log('Token lengths - provided:', token.length, 'expected:', HARDCODED_SECRET.length);
      console.log('Token char codes:');
      console.log('Provided:', [...token].map(c => c.charCodeAt(0)));
      console.log('Expected:', [...HARDCODED_SECRET].map(c => c.charCodeAt(0)));
      return false;
    }
    
    console.log('Token is valid');
    return true;
  } catch (error) {
    console.error('Error verifying secret token:', error);
    return false;
  }
}
