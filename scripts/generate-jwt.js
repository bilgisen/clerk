const fs = require('fs');
const { SignJWT } = require('jose');
const { createSecretKey } = require('crypto');

// Required environment variables
const JWT_SECRET = process.env.JWT_SECRET || process.env.CLERK_SECRET_KEY;
const JWT_ISSUER = process.env.JWT_ISSUER || 'clerk.clerko.v1';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'https://api.clerko.com';

if (!JWT_SECRET) {
  console.error('❌ Missing required environment variables: JWT_SECRET or CLERK_SECRET_KEY');
  process.exit(1);
}

async function generateToken() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const tokenExpiry = 3600; // 1 hour

    // Create a secret key instance from the secret string
    const secretKey = createSecretKey(Buffer.from(JWT_SECRET, 'utf8'));

    // Create the JWT token with Clerk's expected format
    const token = await new SignJWT({
      // Clerk session claims
      azp: JWT_AUDIENCE,
      sub: 'github-actions',
      iat: now,
      exp: now + tokenExpiry,
      nbf: now,
      
      // Custom claims for your application
      metadata: {
        source: 'github-actions',
        workflow: process.env.GITHUB_WORKFLOW || 'unknown',
        run_id: process.env.GITHUB_RUN_ID || 'unknown',
        service: 'github-actions',
        role: 'service-account'
      },
      
      // Required for Clerk
      sid: `github-${process.env.GITHUB_RUN_ID || 'unknown'}`,
      org_id: null,
      role: 'service-account',
      session_state: 'active',
      updated_at: now
    })
    .setProtectedHeader({ 
      alg: 'HS256',
      typ: 'JWT',
      kid: process.env.CLERK_KEY_ID || 'github-actions-1'
    })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setSubject('github-actions')
    .setExpirationTime(now + tokenExpiry)
    .sign(secretKey);

    return token;
  } catch (error) {
    console.error('❌ Error generating JWT token:', error);
    process.exit(1);
  }
}

// Generate and save the token
generateToken()
  .then(token => {
    fs.writeFileSync('jwt-token.txt', token);
    console.log('✅ JWT token generated and saved to jwt-token.txt');
  })
  .catch(error => {
    console.error('❌ Failed to generate JWT token:', error);
    process.exit(1);
  });

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
