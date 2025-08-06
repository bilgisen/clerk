// scripts/generate-jwt.js

const fs = require('fs');
const jwt = require('jsonwebtoken');

const {
  JWT_SECRET,
  JWT_ISSUER,
  JWT_AUDIENCE,
  CONTENT_ID,
  FORMAT
} = process.env;

if (!JWT_SECRET || !JWT_ISSUER || !JWT_AUDIENCE || !CONTENT_ID || !FORMAT) {
  console.error('Missing required environment variables.');
  process.exit(1);
}

const now = Math.floor(Date.now() / 1000);
const payload = {
  sub: 'github-action',
  iss: JWT_ISSUER,
  aud: JWT_AUDIENCE,
  iat: now,
  exp: now + 3600,
  contentId: CONTENT_ID,
  format: FORMAT
};

const token = jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });

fs.writeFileSync('jwt-token.txt', token);
console.log('JWT token generated successfully');
