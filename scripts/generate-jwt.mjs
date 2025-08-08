// scripts/generate-jwt.mjs
import { webcrypto, createSecretKey } from 'node:crypto';
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

import { writeFileSync } from 'fs';
import { SignJWT } from 'jose';

// Required environment variables
const JWT_SECRET = process.env.JWT_SECRET || process.env.CLERK_SECRET_KEY;
const JWT_ISSUER = process.env.JWT_ISSUER || 'clerk.clerko.v1';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'https://api.clerko.com';
const USER_ID = process.env.USER_ID || 'service-account';

if (!JWT_SECRET) {
  console.error('❌ Missing environment variable: JWT_SECRET or CLERK_SECRET_KEY');
  process.exit(1);
}

async function generateToken() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const tokenExpiry = 3600; // 1 hour

    // Create a secret key from the JWT_SECRET
    const secretKey = createSecretKey(
      Buffer.from(JWT_SECRET, 'utf8')
    );

    // Create the JWT token with required claims
    const token = await new SignJWT({
      // Required claims
      sub: USER_ID,
      iat: now,
      exp: now + tokenExpiry,
      nbf: now,
      
      // Custom claims
      userId: USER_ID,
      user: {
        id: USER_ID,
        email: 'service-account@github-actions',
        firstName: 'GitHub',
        lastName: 'Actions'
      },
      
      // Metadata
      metadata: {
        source: 'github-actions',
        workflow: process.env.GITHUB_WORKFLOW || 'unknown',
        run_id: process.env.GITHUB_RUN_ID || 'unknown',
        service: 'github-actions'
      }
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(now + tokenExpiry)
      .sign(secretKey);

    return token;
  } catch (error) {
    console.error('❌ Error in generateToken:', error);
    throw error;
  }
}

// Generate and save token
generateToken()
  .then(token => {
    // Save token to file
    writeFileSync('jwt-token.txt', token);
    
    // Output the token and curl command for testing
    console.log('✅ JWT token generated and saved to jwt-token.txt');
    console.log(`🔐 Token (first 20 chars): ${token.substring(0, 20)}...`);
    
    // Example curl command
    const exampleUrl = 'http://localhost:3000/api/books/by-id/YOUR_BOOK_ID/payload';
    console.log('\nExample usage:');
    console.log(`curl -v -H "Authorization: Bearer ${token}" "${exampleUrl}"`);
  })
  .catch(error => {
    console.error('❌ Error generating JWT token:', error);
    process.exit(1);
  });
