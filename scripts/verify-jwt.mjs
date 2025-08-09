import { createRemoteJWKSet, jwtVerify } from 'jose';

const {
  TOKEN,
  JWT_TOKEN,
  JWT_ISSUER = 'https://sunny-dogfish-14.clerk.accounts.dev',
  JWT_AUDIENCE = 'https://api.clerko.com',
  JWKS_URL,
} = process.env;

const token = TOKEN || JWT_TOKEN;
if (!token) {
  console.error('Provide TOKEN env with the JWT to verify');
  process.exit(1);
}

const jwksUrl = JWKS_URL || `${JWT_ISSUER.replace(/\/$/, '')}/.well-known/jwks.json`;

async function main() {
  const JWKS = createRemoteJWKSet(new URL(jwksUrl));
  try {
    const { payload, protectedHeader } = await jwtVerify(token, JWKS, {
      issuer: JWT_ISSUER.replace(/\/$/, ''),
      audience: JWT_AUDIENCE,
    });
    console.log('✅ Verified');
    console.log('Header:', protectedHeader);
    console.log('Payload:', payload);
  } catch (e) {
    console.error('❌ Verify failed:', e.message);
    process.exit(1);
  }
}

main();
