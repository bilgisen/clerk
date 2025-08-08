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

if (!JWT_SECRET) {
  console.error('❌ Missing environment variable: JWT_SECRET or CLERK_SECRET_KEY');
  process.exit(1);
}

async function generateToken() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const tokenExpiry = 3600; // 1 hour

    // Detect if key is base64 or utf8
    const secretKey = createSecretKey(
      Buffer.from(JWT_SECRET, /^[A-Za-z0-9+/]+={0,2}$/.test(JWT_SECRET) ? 'base64' : 'utf8')
    );

    const token = await new SignJWT({
      azp: JWT_AUDIENCE,
      sub: 'github-actions',
      iat: now,
      exp: now + tokenExpiry,
      nbf: now,
      metadata: {
        source: 'github-actions',
        workflow: process.env.GITHUB_WORKFLOW || 'unknown',
        run_id: process.env.GITHUB_RUN_ID || 'unknown',
        service: 'github-actions',
        role: 'service-account'
      },
      sid: `github-${process.env.GITHUB_RUN_ID || 'unknown'}`,
      org_id: null,
      role: 'service-account',
      session_state: 'active',
      updated_at: now
    })
      .setProtectedHeader({
        alg: 'HS256',
        typ: 'JWT',
      })
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${tokenExpiry}s`)
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
    writeFileSync('jwt-token.txt', token);
    console.log('✅ JWT token generated and saved to jwt-token.txt');
    console.log(`🔐 Token preview: ${token.slice(0, 15)}...`);
  })
  .catch(error => {
    console.error('❌ Error generating JWT token:', error);
    process.exit(1);
  });
