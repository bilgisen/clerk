import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { SignJWT, importPKCS8 } from 'jose';

// Configuration
const CONFIG = {
  PRIVATE_KEY_PATH: process.env.PRIVATE_KEY_PATH || './private.pem',
  JWT_ISSUER: process.env.JWT_ISSUER || 'https://sunny-dogfish-14.clerk.accounts.dev',
  JWT_AUDIENCE: process.env.JWT_AUDIENCE || 'https://sunny-dogfish-14.clerk.accounts.dev',
  USER_ID: process.env.USER_ID || 'github-actions',
  CLERK_KEY_ID: process.env.CLERK_KEY_ID,
  TOKEN_EXPIRY_SECONDS: 3600, // 1 hour
  TOKEN_FILE: 'jwt-token.txt',
  JWT_TEMPLATE: process.env.JWT_TEMPLATE || 'matbuapp'
};

// Log configuration (without sensitive data)
console.log('🔧 JWT Generation Configuration:');
console.log(`- Issuer: ${CONFIG.JWT_ISSUER}`);
console.log(`- Audience: ${CONFIG.JWT_AUDIENCE}`);
console.log(`- Key ID: ${CONFIG.CLERK_KEY_ID ? '***' : 'Not provided'}`);
console.log(`- JWT Template: ${CONFIG.JWT_TEMPLATE}`);

// Validate required environment variables
function validateConfig() {
  if (!CONFIG.CLERK_KEY_ID) {
    throw new Error('Missing required environment variable: CLERK_KEY_ID');
  }

  if (!existsSync(CONFIG.PRIVATE_KEY_PATH)) {
    throw new Error(`Private key file not found at: ${CONFIG.PRIVATE_KEY_PATH}`);
  }

  console.log('🔧 Configuration:');
  console.log(`- Private Key: ${CONFIG.PRIVATE_KEY_PATH} (${existsSync(CONFIG.PRIVATE_KEY_PATH) ? 'exists' : 'missing'})`);
  console.log(`- Issuer: ${CONFIG.JWT_ISSUER}`);
  console.log(`- Audience: ${CONFIG.JWT_AUDIENCE}`);
  console.log(`- Key ID: ${CONFIG.CLERK_KEY_ID}`);
  console.log(`- User ID: ${CONFIG.USER_ID}\n`);
}

async function loadPrivateKey() {
  try {
    console.log('🔑 Loading private key...');
    const privateKeyB64 = readFileSync(CONFIG.PRIVATE_KEY_PATH, 'utf8');
    
    // Decode the base64-encoded private key using Node.js Buffer
    const privateKeyPem = Buffer.from(privateKeyB64, 'base64').toString('utf-8');
    
    // Debug: Verify the private key was decoded correctly
    if (!privateKeyPem || !privateKeyPem.includes('PRIVATE KEY')) {
      console.error('Error: Failed to decode private key or invalid format');
      process.exit(1);
    }
    
    // Validate key format
    if (!privateKeyPem.includes('-----BEGIN PRIVATE KEY-----')) {
      throw new Error('Invalid private key format. Must be PKCS#8 (PEM format)');
    }
    
    console.log('✅ Private key loaded successfully');
    return await importPKCS8(privateKeyPem, 'RS256');
  } catch (error) {
    console.error('❌ Failed to load private key:', error.message);
    throw error;
  }
}

async function generateToken() {
  try {
    validateConfig();
    const privateKey = await loadPrivateKey();
    const now = Math.floor(Date.now() / 1000);

    console.log('\n🔨 Creating JWT token...');
    console.log(`- Algorithm: RS256`);
    console.log(`- Issued At: ${new Date(now * 1000).toISOString()}`);
    console.log(`- Expires At: ${new Date((now + CONFIG.TOKEN_EXPIRY_SECONDS) * 1000).toISOString()}`);

    // Create a JWT token with the required claims
    const token = await new SignJWT({
      // Standard JWT claims
      sub: CONFIG.USER_ID,
      userId: CONFIG.USER_ID,
      // Standard JWT timestamps
      iat: now,
      exp: now + CONFIG.TOKEN_EXPIRY_SECONDS,
      nbf: now - 60, // Not before 1 minute ago
      jti: `github-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
      
      // Custom claims
      role: 'service-account',
      source: 'github-actions',
      
      // Clerk specific claims
      azp: process.env.NEXT_PUBLIC_APP_URL || 'https://matbu.vercel.app',
      template: CONFIG.JWT_TEMPLATE,
      
      // Additional metadata
      metadata: {
        service: 'github-actions',
        workflow: process.env.GITHUB_WORKFLOW || 'unknown',
        run_id: process.env.GITHUB_RUN_ID || 'unknown'
      }
    })
      .setProtectedHeader({
        alg: 'RS256',
        typ: 'JWT',
        kid: CONFIG.CLERK_KEY_ID,
        cty: 'JWT'
      })
      .setIssuer(CONFIG.JWT_ISSUER)
      .setAudience(CONFIG.JWT_AUDIENCE)
      .setIssuedAt(now)
      .setExpirationTime(now + CONFIG.TOKEN_EXPIRY_SECONDS)
      .setNotBefore(now - 60) // Allow for clock skew
      .sign(privateKey);

    // Write token to file
    writeFileSync(CONFIG.TOKEN_FILE, token);
    console.log(`\n✅ Token successfully generated and saved to ${CONFIG.TOKEN_FILE}`);
    
    // Output token info
    const tokenParts = token.split('.');
    console.log('\n🔍 Token Info:');
    console.log(`- Token length: ${token.length} characters`);
    console.log(`- Header:    ${tokenParts[0]}...`);
    console.log(`- Payload:   ${tokenParts[1]}...`);
    console.log(`- Signature: ...${tokenParts[2].slice(-10)}`);
    
    return token;
  } catch (error) {
    console.error('\n❌ Token generation failed:', error.message);
    throw error;
  }
}

// Run the generator
generateToken()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
