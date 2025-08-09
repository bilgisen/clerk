import fetch from 'node-fetch';

const { CLERK_SECRET_KEY, CLERK_API_VERSION = '2024-10-01' } = process.env;

if (!CLERK_SECRET_KEY) {
  console.error('Missing CLERK_SECRET_KEY');
  process.exit(1);
}

async function req(path) {
  const res = await fetch(`https://api.clerk.com${path}`, {
    headers: {
      'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
      'Clerk-API-Version': CLERK_API_VERSION,
    },
  });
  const text = await res.text();
  console.log(`\nGET ${path} -> ${res.status}`);
  console.log(text.slice(0, 600));
}

(async () => {
  try {
    await req('/v1/users?limit=1');
  } catch (e) {
    console.error('Smoke failed:', e);
    process.exit(1);
  }
})();
