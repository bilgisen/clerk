import { createClerkClient } from '@clerk/clerk-sdk-node';

const {
  CLERK_SECRET_KEY,
  USER_ID,
  USER_EMAIL,
  JWT_TEMPLATE,
  NEXT_PUBLIC_APP_URL,
  CLERK_API_URL, // not required; SDK uses default
  CLERK_API_VERSION, // optional; SDK handles versions, but can be set via env
} = process.env;

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env: ${name}`);
  }
  return v;
}

async function main() {
  console.log('🔧 SDK Mint Template | Env check');
  console.log('- CLERK_SECRET_KEY:', CLERK_SECRET_KEY ? 'present' : 'missing');
  console.log('- USER_ID:', USER_ID || 'missing');
  console.log('- USER_EMAIL:', USER_EMAIL || 'not set');
  console.log('- JWT_TEMPLATE:', JWT_TEMPLATE || 'missing');
  console.log('- NEXT_PUBLIC_APP_URL:', NEXT_PUBLIC_APP_URL || 'not set');
  if (!requireEnv('CLERK_SECRET_KEY') || !requireEnv('JWT_TEMPLATE')) {
    process.exit(1);
  }

  const clerk = createClerkClient({
    secretKey: CLERK_SECRET_KEY,
    // baseUrl: CLERK_API_URL, // only if you must override
    // apiVersion: CLERK_API_VERSION, // only if you must pin
  });

  try {
    // Resolve a valid Clerk user ID
    let subject = USER_ID;
    if (!subject || !subject.startsWith('user_')) {
      if (USER_EMAIL) {
        console.log('🔎 Resolving Clerk user by email:', USER_EMAIL);
        const list = await clerk.users.getUserList({ emailAddress: [USER_EMAIL], limit: 1 });
        const user = Array.isArray(list) ? list[0] : list?.data?.[0];
        if (!user?.id) {
          console.error('❌ Could not resolve Clerk user by email.');
          process.exit(1);
        }
        subject = user.id;
        console.log('✅ Resolved USER_ID:', subject);
      } else if (USER_ID) {
        console.warn('⚠️ USER_ID does not look like a Clerk user id (expected to start with "user_"). Proceeding anyway:', USER_ID);
        subject = USER_ID;
      } else {
        console.error('❌ Provide USER_ID (user_...) or USER_EMAIL to resolve the user.');
        process.exit(1);
      }
    }

    console.log('\n🔐 Minting JWT via Clerk SDK...');
    if (!clerk.jwts || typeof clerk.jwts.createJWT !== 'function') {
      console.error('❌ clerk.jwts.createJWT is not available in this SDK version.');
      console.error('👉 Run: npm i -S @clerk/clerk-sdk-node@latest');
      console.error('Then re-run this script.');
      process.exit(1);
    }

    const res = await clerk.jwts.createJWT({
      template: JWT_TEMPLATE,
      userId: subject,
      claims: {
        azp: NEXT_PUBLIC_APP_URL || 'https://matbu.vercel.app',
      },
    });

    if (!res?.jwt) {
      console.error('❌ No jwt in response:', res);
      process.exit(1);
    }

    console.log('✅ JWT minted via SDK');
    console.log(res.jwt);
    process.exit(0);
  } catch (e) {
    const detail = e?.response?.data || e?.message || e;
    console.error('❌ Mint via SDK failed:', detail);
    process.exit(1);
  }
}

main();
