const fs = require('fs');
const jwt = require('jsonwebtoken');

const {
  JWT_SECRET,
  JWT_ISSUER,
  JWT_AUDIENCE
} = process.env;

if (!JWT_SECRET || !JWT_ISSUER || !JWT_AUDIENCE) {
  console.error('❌ Missing required environment variables.');
  console.error('Required: JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE');
  process.exit(1);
}

const now = Math.floor(Date.now() / 1000);

const payload = {
  sub: 'github-action',
  iss: JWT_ISSUER,
  aud: JWT_AUDIENCE,
  iat: now,
  exp: now + 300 // 5 dakika geçerli
};

console.log("🛠️ Generating JWT with payload:");
console.log(JSON.stringify(payload, null, 2));

try {
  const token = jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
  fs.writeFileSync('jwt-token.txt', token);
  console.log('✅ JWT token generated and saved to jwt-token.txt');
} catch (err) {
  console.error('❌ Failed to generate JWT:', err.message);
  process.exit(1);
}
