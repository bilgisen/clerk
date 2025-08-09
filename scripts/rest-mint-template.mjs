/*
 Mint a JWT from a Clerk JWT template using Clerk Backend API (REST).
 - Resolves userId from USER_EMAIL if needed
 - Tries multiple endpoints/payloads for compatibility
 - Uses Clerk-API-Version from env or defaults to a recent value (2025-04-10)
*/

const {
  CLERK_SECRET_KEY,
  USER_ID,
  USER_EMAIL,
  JWT_TEMPLATE,
  NEXT_PUBLIC_APP_URL,
  CLERK_API_URL = 'https://api.clerk.com',
  CLERK_API_VERSION = '2025-04-10',
} = process.env;

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env: ${name}`);
  }
  return v;
}

function safeUrl(base, path) {
  return new URL(path, base.replace(/\/$/, '/') + '/').toString();
}

async function api(path, opts = {}) {
  const url = safeUrl(CLERK_API_URL, path);
  const headers = {
    'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
    'Clerk-API-Version': CLERK_API_VERSION,
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  return { res, text, url, headers };
}

async function resolveUserId() {
  if (USER_ID && USER_ID.startsWith('user_')) return USER_ID;
  if (USER_ID && !USER_ID.startsWith('user_')) {
    console.warn('USER_ID does not look like a Clerk user id (expected to start with "user_"). Proceeding anyway:', USER_ID);
    return USER_ID;
  }
  if (!USER_EMAIL) {
    throw new Error('Provide USER_ID (user_...) or USER_EMAIL to resolve the user');
  }
  // Query by email
  const q = new URLSearchParams();
  q.append('email_address[]', USER_EMAIL);
  q.append('limit', '1');
  const { res, text, url } = await api(`/v1/users?${q.toString()}`, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`Failed to resolve user by email (${USER_EMAIL}) ${res.status}: ${text}`);
  }
  let data;
  try { data = JSON.parse(text); } catch { data = null; }
  const user = Array.isArray(data) ? data[0] : data?.data?.[0];
  if (!user?.id) {
    throw new Error(`No user found for email ${USER_EMAIL}. Response: ${text.slice(0, 500)}`);
  }
  return user.id;
}

async function mint() {
  console.log('🔧 REST Mint Template | Env check');
  console.log('- CLERK_SECRET_KEY:', CLERK_SECRET_KEY ? 'present' : 'missing');
  console.log('- USER_ID:', USER_ID || 'missing');
  console.log('- USER_EMAIL:', USER_EMAIL || 'not set');
  console.log('- JWT_TEMPLATE:', JWT_TEMPLATE || 'missing');
  console.log('- NEXT_PUBLIC_APP_URL:', NEXT_PUBLIC_APP_URL || 'not set');
  console.log('- CLERK_API_URL:', CLERK_API_URL);
  console.log('- CLERK_API_VERSION:', CLERK_API_VERSION);
  if (!requireEnv('CLERK_SECRET_KEY') || !requireEnv('JWT_TEMPLATE')) {
    process.exit(1);
  }

  const userId = await resolveUserId();
  const azp = NEXT_PUBLIC_APP_URL || 'https://matbu.vercel.app';

  const attempts = [
    {
      path: '/v1/jwts/issue',
      body: { template: JWT_TEMPLATE, claims: { sub: userId, azp } },
      note: 'POST /v1/jwts/issue with claims.sub',
    },
    {
      path: `/v1/jwt_templates/${encodeURIComponent(JWT_TEMPLATE)}/issue`,
      body: { claims: { sub: userId, azp } },
      note: 'POST /v1/jwt_templates/{template}/issue with claims.sub',
    },
    {
      path: '/v1/jwts',
      body: { template: JWT_TEMPLATE, claims: { sub: userId, azp } },
      note: 'POST /v1/jwts with claims.sub',
    },
    {
      path: '/v1/jwts',
      body: { template: JWT_TEMPLATE, sub: userId, claims: { azp } },
      note: 'POST /v1/jwts with top-level sub',
    },
  ];

  const errors = [];
  for (const attempt of attempts) {
    const { path, body, note } = attempt;
    try {
      const { res, text, url } = await api(path, { method: 'POST', body: JSON.stringify(body) });
      console.log(`\n🚀 Attempt: ${note}`);
      console.log('🌐 Endpoint:', url);
      console.log('📤 Body:', JSON.stringify(body));
      console.log('📥 Status:', res.status);
      if (res.ok) {
        let data;
        try { data = JSON.parse(text); } catch { data = {}; }
        const token = data?.jwt || data?.token || data?.data?.jwt; // accommodate variants
        if (!token) {
          console.log('ℹ️ Response text (first 500):', text.slice(0, 500));
          throw new Error('No jwt field in response');
        }
        console.log('✅ JWT minted via REST');
        console.log(token);
        return;
      } else {
        console.log('❌ Response text (first 500):', text.slice(0, 500));
        errors.push({ path, status: res.status, body, text: text.slice(0, 500) });
      }
    } catch (e) {
      console.log('💥 Error:', e.message);
      errors.push({ path, error: e.message });
    }
  }

  console.error('\nAll attempts failed. Summary:');
  for (const err of errors) {
    console.error(err);
  }
  process.exit(1);
}

mint().catch((e) => { console.error('Fatal:', e); process.exit(1); });
