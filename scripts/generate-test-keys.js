const { generateKeyPair } = require('crypto');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const generateKeyPairAsync = promisify(generateKeyPair);

async function generateKeys() {
  try {
    const { publicKey, privateKey } = await generateKeyPairAsync('ed25519', {
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    // Convert to base64 for environment variables
    const publicKeyB64 = Buffer.from(publicKey).toString('base64');
    const privateKeyB64 = Buffer.from(privateKey).toString('base64');

    // Write to files
    fs.writeFileSync(path.join(__dirname, '../test-keys/public.pem'), publicKey);
    fs.writeFileSync(path.join(__dirname, '../test-keys/private.pem'), privateKey);
    fs.writeFileSync(path.join(__dirname, '../test-keys/public.b64'), publicKeyB64);
    fs.writeFileSync(path.join(__dirname, '../test-keys/private.b64'), privateKeyB64);

    console.log('Test keys generated successfully!');
    console.log('Public Key (base64):', publicKeyB64);
    console.log('Private Key (base64):', privateKeyB64);
  } catch (error) {
    console.error('Error generating keys:', error);
    process.exit(1);
  }
}

generateKeys();
