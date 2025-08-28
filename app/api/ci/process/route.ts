// app/api/ci/process/route.ts
import { NextResponse } from 'next/server';
import { withGithubOidcAuth } from '@/middleware/old/auth';
import type { NextRequest } from 'next/server';
import type { AuthContextUnion } from '@/types/auth';

// Basic in-memory idempotency cache (replace with Redis in production)
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE = 500;
const cache = new Map<string, { at: number }>();

// Simple cache garbage collection
function gcCache() {
  const now = Date.now();
  for (const [key, { at }] of cache) {
    if (now - at > IDEMPOTENCY_TTL_MS) cache.delete(key);
  }
  // Enforce max cache size
  if (cache.size > MAX_CACHE) {
    const keys = Array.from(cache.keys()).slice(0, cache.size - MAX_CACHE);
    keys.forEach(key => cache.delete(key));
  }
}

async function readJsonSafe(body: ReadableStream<Uint8Array> | null): Promise<any> {
  if (!body) return undefined;
  try {
    return await new Response(body).json();
  } catch {
    return undefined;
  }
}

// POST /api/ci/process
// Protected by OIDC token. Called by CI to trigger content processing.
// Headers: { 
//   Authorization: 'Bearer <OIDC_TOKEN>',
//   'Idempotency-Key': 'unique-request-id'
// }
// Body: { contentId: string, mode?: string }
// Extend the request type to include authContext
type AuthenticatedRequest = NextRequest & {
  authContext: AuthContextUnion;
};

export const POST = withGithubOidcAuth(async (request) => {
  const req = request as unknown as AuthenticatedRequest;
  const { authContext } = req;
  
  // The auth middleware ensures we have a valid GitHub OIDC context
  if (authContext.type !== 'github-oidc') {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'INVALID_AUTH_CONTEXT' },
      { status: 401 }
    );
  }
  
  // Log the request for auditing
  console.log('CI process request', {
    repository: authContext.repository,
    runId: authContext.run_id, // Use run_id to match the type
    workflow: authContext.workflow,
    userId: authContext.userId
  });

  // Verify content type
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return NextResponse.json(
      { error: 'invalid_content_type', message: 'Content-Type must be application/json' },
      { status: 415 }
    );
  }

  // Handle idempotency
  const idempotencyKey = request.headers.get('x-idempotency-key') || request.headers.get('idempotency-key') || '';
  if (!idempotencyKey) {
    return NextResponse.json(
      { error: 'missing_idempotency_key', message: 'Idempotency-Key header is required' },
      { status: 400 }
    );
  }

  // Check for duplicate request
  gcCache();
  if (cache.has(idempotencyKey)) {
    return NextResponse.json(
      { status: 'duplicate', idempotencyKey },
      { status: 200 }
    );
  }
  cache.set(idempotencyKey, { at: Date.now() });

  // Parse and validate request body
  const body = await readJsonSafe(req.body);
  const contentId = typeof body?.contentId === 'string' ? body.contentId : undefined;
  const mode = typeof body?.mode === 'string' ? body.mode : 'default';
  
  if (!contentId || !/^[a-zA-Z0-9_\-\/.]{1,200}$/.test(contentId)) {
    return NextResponse.json(
      { error: 'invalid_content_id', message: 'Invalid or missing contentId' },
      { status: 400 }
    );
  }

  try {
    // TODO: Trigger your actual job processing here
    // This is where you would typically enqueue a background task
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    // Log the request for auditing
    console.log(`Processing request for contentId: ${contentId}`);
    
    // Prepare success response
    const response = {
      status: 'processing',
      jobId,
      contentId,
      mode,
      timestamps: {
        received: new Date().toISOString(),
      },
      _links: {
        status: { href: `/api/jobs/${jobId}` },
        cancel: { 
          href: `/api/jobs/${jobId}`, 
          method: 'DELETE', 
          headers: {
            Authorization: 'Bearer <OIDC_TOKEN>'
          } 
        }
      }
    };

    return NextResponse.json(response, { status: 202 });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { 
        error: 'processing_error', 
        message: 'Failed to process request',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
});

// GET /api/ci/process/health
// Public health check endpoint
export async function GET() {
  gcCache(); // Clean up old cache entries
  return NextResponse.json({ 
    status: 'ok',
    cacheSize: cache.size,
    timestamp: new Date().toISOString()
  });
}
