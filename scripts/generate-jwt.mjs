import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

import { writeFileSync, readFileSync } from 'fs';
import { SignJWT, importPKCS8 } from 'jose';

const PRIVATE_KEY_PATH = process.env.PRIVATE_KEY_PATH || './private.pem';
const JWT_ISSUER = process.env.JWT_ISSUER || 'https://sunny-dogfish-14.clerk.accounts.dev';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'https://sunny-dogfish-14.clerk.accounts.dev';
const USER_ID = process.env.USER_ID || 'service-account';
const CLERK_KEY_ID = process.env.CLERK_KEY_ID;

if (!CLERK_KEY_ID) {
  console.error('❌ Missing env: CLERK_KEY_ID');
  process.exit(1);
}

async function generateToken() {
  const now = Math.floor(Date.now() / 1000);
  const privateKeyPem = readFileSync(PRIVATE_KEY_PATH, 'utf8');

  const privateKey = await importPKCS8(privateKeyPem, 'RS256');

  const token = await new SignJWT({
    sub: USER_ID,
    userId: USER_ID
  })
    .setProtectedHeader({
      alg: 'RS256',
      typ: 'JWT',
      kid: CLERK_KEY_ID
    })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  writeFileSync('jwt-token.txt', token);
  console.log('✅ Token created.');
}

generateToken().catch((err) => {
  console.error('❌ Token generation failed:', err);
  process.exit(1);
});
