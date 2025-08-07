const fs = require('fs');
const jwt = require('jsonwebtoken');

// Required environment variables
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ISSUER = 'clerk.clerko.v1';
const JWT_AUDIENCE = 'https://api.clerko.com';

if (!JWT_SECRET) {
  console.error('❌ Missing required environment variable: JWT_SECRET');
  process.exit(1);
}

const now = Math.floor(Date.now() / 1000);
const tokenExpiry = 3600; // 1 hour

// Create the JWT payload with all required claims
const payload = {
  // Standard claims
  iss: JWT_ISSUER,
  aud: JWT_AUDIENCE,
  sub: 'github-actions',
  iat: now,
  exp: now + tokenExpiry,
  
  // Custom claims
  userId: 'github-actions',
  name: 'GitHub Actions Workflow',
  role: 'service-account',
  service: 'github-actions',
  
  // Add any additional claims needed by your application
  metadata: {
    source: 'github-actions',
    workflow: process.env.GITHUB_WORKFLOW || 'unknown',
    run_id: process.env.GITHUB_RUN_ID || 'unknown'
  }
};

console.log('🛠️ Generating JWT with the following claims:');
console.log(JSON.stringify({
  ...payload,
  // Don't log sensitive data
  iat: new Date(payload.iat * 1000).toISOString(),
  exp: new Date(payload.exp * 1000).toISOString()
}, null, 2));

try {
  // Generate the token
  const token = jwt.sign(
    payload,
    JWT_SECRET,
    { 
      algorithm: 'HS256',
      header: {
        typ: 'JWT',
        alg: 'HS256',
        kid: 'github-actions-1'
      }
    }
  );

  // Save the token to a file
  fs.writeFileSync('jwt-token.txt', token);
  
  // Log success with token info (don't log the full token in production)
  const tokenParts = token.split('.');
  console.log('✅ JWT token generated successfully');
  console.log(`   Header:  ${tokenParts[0]}`);
  console.log(`   Payload: ${tokenParts[1]}`);
  console.log(`   Signature: ${tokenParts[2].substring(0, 10)}...`);
  console.log(`   Expires: ${new Date(payload.exp * 1000).toISOString()}`);
  
  // Verify the token can be decoded (sanity check)
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('🔍 Token verification test passed');
  } catch (verifyError) {
    console.error('❌ Token verification test failed:', verifyError.message);
    process.exit(1);
  }
  
} catch (err) {
  console.error('❌ Failed to generate JWT:', err.message);
  process.exit(1);
}
