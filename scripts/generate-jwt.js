// scripts/generate-jwt.js

const fs = require('fs');
const jwt = require('jsonwebtoken');

const {
  CLERK_JWT_KEY,
  JWT_ISSUER,
  JWT_AUDIENCE,
  CONTENT_ID,
  FORMAT
} = process.env;

if (!CLERK_JWT_KEY || !JWT_ISSUER || !JWT_AUDIENCE || !CONTENT_ID || !FORMAT) {
  console.error('Missing required environment variables.');
  console.error('Required: CLERK_JWT_KEY, JWT_ISSUER, JWT_AUDIENCE, CONTENT_ID, FORMAT');
  process.exit(1);
}

const JWT_SECRET = CLERK_JWT_KEY; // Use CLERK_JWT_KEY as the JWT secret

const now = Math.floor(Date.now() / 1000);
// For GitHub Actions, we'll use a special service user ID
// This should be a dedicated service account ID from your database
const payload = {
  sub: 'github-action',
  iss: JWT_ISSUER,
  aud: JWT_AUDIENCE,
  iat: now,
  exp: now + 3600,
  userId: 'github-actions-service',  // This matches the expected userId field in auth
  contentId: CONTENT_ID,
  format: FORMAT
};

const token = jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });

fs.writeFileSync('jwt-token.txt', token);
console.log('JWT token generated successfully');
