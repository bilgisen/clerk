// app/api/ci/process/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { verifySecretToken } from '@/lib/auth/verifySecret';

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
// Protected by secret token. Called by CI to trigger content processing.
// Headers: { 
//   Authorization: 'Bearer PAYLOAD_71y15GYgRYGMe16a4',
//   'Idempotency-Key': 'unique-request-id'
// }
// Body: { contentId: string, mode?: string }
export async function POST(req: NextRequest) {
  // Verify secret token first
  const isAuthenticated = await verifySecretToken(req);
  if (!isAuthenticated) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Invalid or missing authentication token' },
      { status: 401 }
    );
  }

  // Verify content type
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return NextResponse.json(
      { error: 'invalid_content_type', message: 'Content-Type must be application/json' },
      { status: 415 }
    );
  }

  // Handle idempotency
  const idempotencyKey = req.headers.get('x-idempotency-key') || req.headers.get('idempotency-key') || '';
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
        cancel: { href: `/api/jobs/${jobId}`, method: 'DELETE' }
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
}

// GET /api/ci/process/health
// Public health check endpoint
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
