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
    
    // First try to read from file if PRIVATE_KEY_PATH is set
    if (existsSync(CONFIG.PRIVATE_KEY_PATH)) {
      console.log(`Reading private key from file: ${CONFIG.PRIVATE_KEY_PATH}`);
      const privateKeyContent = readFileSync(CONFIG.PRIVATE_KEY_PATH, 'utf8');
      
      // Check if the file content is base64 encoded
      if (privateKeyContent.trim().match(/^[A-Za-z0-9+/=]+$/) && 
          privateKeyContent.length > 100) { // Simple check for base64
        console.log('Detected base64-encoded private key, decoding...');
        const privateKeyPem = Buffer.from(privateKeyContent, 'base64').toString('utf-8');
        if (privateKeyPem.includes('PRIVATE KEY')) {
          console.log('✅ Private key decoded successfully from base64');
          return privateKeyPem;
        }
      } else if (privateKeyContent.includes('PRIVATE KEY')) {
        console.log('✅ Private key loaded directly from PEM file');
        return privateKeyContent;
      }
    }
    
    // If we get here, try to use PRIVATE_KEY_B64 from environment
    if (process.env.PRIVATE_KEY_B64) {
      console.log('Using PRIVATE_KEY_B64 from environment');
      const privateKeyPem = Buffer.from(process.env.PRIVATE_KEY_B64, 'base64').toString('utf-8');
      if (privateKeyPem.includes('PRIVATE KEY')) {
        console.log('✅ Private key loaded successfully from PRIVATE_KEY_B64');
        return privateKeyPem;
      }
    }
    
    throw new Error('No valid private key found. Please provide either a valid PRIVATE_KEY_PATH or PRIVATE_KEY_B64 environment variable');
  } catch (error) {
    console.error('❌ Error loading private key:', error.message);
    console.error('Please ensure you have provided a valid private key');
    console.error('The key should be in PEM format (starting with -----BEGIN PRIVATE KEY-----)');
    console.error('You can provide it either as a file or base64-encoded in PRIVATE_KEY_B64');
    process.exit(1);
  }
}

async function generateToken() {
  try {
    console.log('\n🔧 Starting token generation...');
    
    // Log environment info
    console.log('\n🔧 Environment Info:');
    console.log(`- Node.js: ${process.version}`);
    console.log(`- Platform: ${process.platform} ${process.arch}`);
    console.log(`- JWT_ISSUER: ${process.env.JWT_ISSUER}`);
    console.log(`- JWT_AUDIENCE: ${process.env.JWT_AUDIENCE}`);
    console.log(`- CLERK_KEY_ID: ${process.env.CLERK_KEY_ID ? '***' + process.env.CLERK_KEY_ID.slice(-4) : 'Not set'}`);
    console.log(`- JWT_TEMPLATE: ${process.env.JWT_TEMPLATE}`);
    
    // Validate configuration
    console.log('\n🔍 Validating configuration...');
    validateConfig();
    
    // Load private key
    console.log('\n🔑 Loading private key...');
    const privateKeyPem = await loadPrivateKey();
    console.log('✅ Private key loaded successfully');
    
    // Log private key info (first and last 20 chars for debugging)
    const keyPreview = privateKeyPem
      .replace(/\s+/g, ' ')
      .trim();
    console.log(`🔑 Private key preview: ${keyPreview.substring(0, 30)}...${keyPreview.slice(-20)}`);
    
    try {
      // Import the private key
      console.log('\n🔑 Importing private key...');
      const privateKey = await importPKCS8(privateKeyPem, 'RS256').catch(async (importError) => {
        console.error('❌ Failed to import private key:', importError.message);
        
        // Try to get more details about the key
        const keyLines = privateKeyPem.split('\n');
        console.log('\n🔍 Private key analysis:');
        console.log(`- Total length: ${privateKeyPem.length} characters`);
        console.log(`- First line: ${keyLines[0] || 'Empty'}`);
        console.log(`- Last line: ${keyLines[keyLines.length - 1] || 'Empty'}`);
        console.log(`- Contains BEGIN PRIVATE KEY: ${privateKeyPem.includes('BEGIN PRIVATE KEY')}`);
        console.log(`- Contains BEGIN RSA PRIVATE KEY: ${privateKeyPem.includes('BEGIN RSA PRIVATE KEY')}`);
        
        throw importError;
      });
      
      console.log('✅ Private key imported successfully');
      
      // Generate JWT token
      console.log('\n🔨 Generating JWT token...');
      
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        sub: CONFIG.USER_ID,
        azp: process.env.NEXT_PUBLIC_APP_URL || 'https://matbu.vercel.app',
        template: CONFIG.JWT_TEMPLATE,
        iat: now,
        exp: now + 3600, // 1 hour
        jti: crypto.randomUUID(),
      };
      
      console.log('\n📝 JWT Payload:');
      console.log(JSON.stringify(payload, null, 2));
      
      const protectedHeader = {
        alg: 'RS256',
        typ: 'JWT',
        kid: CONFIG.CLERK_KEY_ID,
      };
      
      console.log('\n📝 JWT Header:');
      console.log(JSON.stringify(protectedHeader, null, 2));
      
      const token = await new SignJWT(payload)
        .setProtectedHeader(protectedHeader)
        .setIssuer(CONFIG.JWT_ISSUER)
        .setAudience(CONFIG.JWT_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);
      
      // Save token to file
      writeFileSync(CONFIG.TOKEN_FILE, token);
      console.log(`\n✅ Token successfully saved to ${CONFIG.TOKEN_FILE}`);
      
      // Debug: Print token info
      console.log('\n✅ JWT token generated successfully');
      
      try {
        // Get the token parts for verification
        const [header, payload, signature] = token.split('.');
        
        // Decode and log the header and payload for debugging
        const decodedHeader = JSON.parse(Buffer.from(header, 'base64').toString('utf-8'));
        const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
        
        console.log('\n🔐 JWT Header:');
        console.log(JSON.stringify(decodedHeader, null, 2));
        
        console.log('\n🔐 JWT Payload:');
        console.log(JSON.stringify(decodedPayload, null, 2));
        
        console.log('\n🔐 JWT Signature (first 10 chars):', signature.substring(0, 10) + '...');
        
        console.log('\n🔐 JWT Token (first 50 chars):', token.substring(0, 50) + '...');
      } catch (decodeError) {
        console.error('\n⚠️ Failed to decode token for debugging:', decodeError.message);
        console.log('Raw token (first 100 chars):', token.substring(0, 100));
      }
      
      return token;
    } catch (keyError) {
      console.error('\n❌ Failed to import private key:', keyError.message);
      console.error('Error stack:', keyError.stack);
      
      if (keyError.code === 'ERR_OSSL_UNSUPPORTED') {
        console.error('\n⚠️ This usually means the private key format is incorrect.');
        console.error('Please ensure you are using a valid PKCS#8 private key in PEM format.');
        console.error('The key should start with: -----BEGIN PRIVATE KEY-----');
        console.error('If your key starts with -----BEGIN RSA PRIVATE KEY-----, you need to convert it to PKCS#8 format.');
        console.error('You can convert it using: openssl pkcs8 -topk8 -inform PEM -outform PEM -in private.key -out private.pk8 -nocrypt');
      }
      
      throw keyError;
    }
  } catch (error) {
    console.error('\n❌ Token generation failed:', error.message);
    console.error('Error stack:', error.stack);
    
    // Log environment variables (excluding sensitive ones)
    console.log('\n🔧 Environment:');
    console.log('- Node.js version:', process.version);
    console.log('- Platform:', process.platform);
    console.log('- JWT_ISSUER:', process.env.JWT_ISSUER);
    console.log('- JWT_AUDIENCE:', process.env.JWT_AUDIENCE);
    console.log('- CLERK_KEY_ID:', process.env.CLERK_KEY_ID ? '***' + process.env.CLERK_KEY_ID.slice(-4) : 'Not set');
    console.log('- JWT_TEMPLATE:', process.env.JWT_TEMPLATE);
    
    // Exit with error code 1 to ensure the workflow fails
    process.exit(1);
  } finally {
    console.log('\n🏁 Token generation process completed');
  }
}

// Run the generator
generateToken()
  .then(token => {
    // Only output the token on success (this will be the last line of output)
    console.log(token);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error generating token:', error.message);
    process.exit(1);
  });
