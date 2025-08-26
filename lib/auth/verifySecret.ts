import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * Verifies the request using either Clerk authentication or GitHub Workflow secret
 * @param req Next.js request object
 * @returns boolean indicating if the request is authenticated
 */
export async function verifySecretToken(req: NextRequest): Promise<boolean> {
  try {
    // 1. First try GitHub Workflow secret verification
    const authHeader = req.headers.get('authorization');
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1]?.trim();
      const secret = process.env.GT_PAYLOAD_SECRET;
      
      if (token && secret && token === secret) {
        console.log('✅ GitHub Workflow authentication successful');
        return true;
      }
    }
    
    // 2. If GitHub Workflow auth fails, try Clerk auth
    const session = await auth();
    if (session?.userId) {
      console.log('✅ Clerk authentication successful for user:', session.userId);
      return true;
    }
    
    console.error('❌ Authentication failed: No valid authentication method found');
    return false;
    
  } catch (error) {
    console.error('❌ Error during authentication:', error);
    return false;
  }
}
