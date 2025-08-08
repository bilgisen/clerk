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
const CLERK_KEY_ID = process.env.CLERK_KEY_ID || 'ins_2yhHfvuC7eV6d8wuj44hPANY5Kq'; // From the error message

if (!JWT_SECRET) {
  console.error('❌ Missing environment variable: JWT_SECRET or CLERK_SECRET_KEY');
  process.exit(1);
}

async function generateToken() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const tokenExpiry = 3600; // 1 hour

    // Create a secret key from the JWT_SECRET
    const secretKey = new TextEncoder().encode(JWT_SECRET);

    // Create the JWT token with required claims
    const token = await new SignJWT({
      // Standard claims
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
        service: 'github-actions',
        contentId: process.env.CONTENT_ID || 'unknown',
        environment: process.env.NODE_ENV || 'production',
        // Add any additional metadata needed by your application
        ...(process.env.GITHUB_ACTION ? {
          github: {
            action: process.env.GITHUB_ACTION,
            actor: process.env.GITHUB_ACTOR,
            run_id: process.env.GITHUB_RUN_ID,
            workflow: process.env.GITHUB_WORKFLOW
          }
        } : {})
      }
    })
      .setProtectedHeader({
        alg: 'HS256',  // Using HS256 with the secret key
        typ: 'JWT',
        kid: CLERK_KEY_ID  // Clerk key ID is still included in the header
      })
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
    const bookId = process.env.CONTENT_ID || 'YOUR_BOOK_ID';
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const exampleUrl = `${baseUrl}/api/books/by-id/${bookId}/payload`;
    
    console.log('\nExample usage:');
    console.log(`export JWT_TOKEN="${token}"`);
    console.log(`curl -v -H "Authorization: Bearer $JWT_TOKEN" "${exampleUrl}"`);
    
    // Also output the token payload for verification
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      console.log('\n🔍 Token payload:');
      console.log(JSON.stringify(payload, null, 2));
    } catch (e) {
      console.warn('\n⚠️ Could not decode token payload:', e.message);
    }
  })
  .catch(error => {
    console.error('❌ Error generating JWT token:', error);
    process.exit(1);
  });
