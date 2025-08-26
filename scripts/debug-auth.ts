import { verifySecretToken } from '../lib/auth/verifySecret';

// Test the verifySecretToken function directly
async function testVerifyToken() {
  // Set the environment variable
  process.env.GT_PAYLOAD_SECRET = '71y15GYgRYGMe1$6a4';
  
  // Create a mock request with the token
  const mockRequest = {
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === 'authorization') {
          return 'Bearer 71y15GYgRYGMe1$6a4';
        }
        return null;
      }
    }
  } as unknown as NextRequest;

  try {
    const isValid = await verifySecretToken(mockRequest);
    console.log('Token validation result:', isValid);
    console.log('GT_PAYLOAD_SECRET:', process.env.GT_PAYLOAD_SECRET);
  } catch (error) {
    console.error('Error during token verification:', error);
  }
}

testVerifyToken();
