// app/api/ci/process/route.ts
import { NextResponse } from 'next/server'
import { withGithubOidc, AuthedRequest } from '@/lib/middleware/withGithubOidc'

// Basic in-memory idempotency cache (replace with Redis in production)
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000 // 10 minutes
const MAX_CACHE = 500
const cache = new Map<string, { at: number }>()

// Simple cache garbage collection
function gcCache() {
  const now = Date.now()
  for (const [key, { at }] of cache) {
    if (now - at > IDEMPOTENCY_TTL_MS) cache.delete(key)
  }
  // Enforce max cache size
  if (cache.size > MAX_CACHE) {
    const keys = Array.from(cache.keys()).slice(0, cache.size - MAX_CACHE)
    keys.forEach(key => cache.delete(key))
  }
}

async function readJsonSafe(body: ReadableStream<Uint8Array> | null): Promise<any> {
  if (!body) return undefined
  try {
    return await new Response(body).json()
  } catch {
    return undefined
  }
}

// Apply GitHub OIDC middleware to verify the token
// This bypasses Clerk authentication for CI/CD workflows
export const POST = withGithubOidc(async (req: AuthedRequest) => {
  // Verify content type
  const contentType = req.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    return NextResponse.json(
      { error: 'invalid_content_type', message: 'Content-Type must be application/json' },
      { status: 415 }
    )
  }

  // Handle idempotency
  const idempotencyKey = req.headers.get('x-idempotency-key') || req.headers.get('idempotency-key') || ''
  if (!idempotencyKey) {
    return NextResponse.json(
      { error: 'missing_idempotency_key', message: 'Idempotency-Key header is required' },
      { status: 400 }
    )
  }

  // Check for duplicate request
  gcCache()
  if (cache.has(idempotencyKey)) {
    return NextResponse.json(
      { status: 'duplicate', idempotencyKey },
      { status: 200 }
    )
  }
  cache.set(idempotencyKey, { at: Date.now() })

  // Parse and validate request body
  const body = await readJsonSafe(req.body)
  const contentId = typeof body?.contentId === 'string' ? body.contentId : undefined
  const mode = typeof body?.mode === 'string' ? body.mode : 'default'
  
  if (!contentId || !/^[a-zA-Z0-9_\-\/.]{1,200}$/.test(contentId)) {
    return NextResponse.json(
      { error: 'invalid_content_id', message: 'Invalid or missing contentId' },
      { status: 400 }
    )
  }

  try {
    // TODO: Trigger your actual job processing here
    // This is where you would typically enqueue a background task
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    
    // Log the authenticated request for auditing
    console.log(`Processing request for contentId: ${contentId} from repo: ${req.claims?.repository}@${req.claims?.ref}`)
    
    // Prepare success response
    const response = {
      status: 'processing',
      jobId,
      contentId,
      mode,
      // Include minimal repository info for observability
      metadata: {
        repository: req.claims?.repository,
        ref: req.claims?.ref,
        workflow: req.claims?.workflow,
        actor: req.claims?.actor,
        runId: req.claims?.run_id,
      },
      timestamps: {
        received: new Date().toISOString(),
      },
      _links: {
        status: `/api/ci/status/${jobId}`,
        cancel: `/api/ci/cancel/${jobId}`,
      },
    }
    
    return NextResponse.json(response, { status: 202 })
    
  } catch (error) {
    console.error('Error processing request:', error)
    
    // Remove from cache on error to allow retries
    cache.delete(idempotencyKey)
    
    return NextResponse.json(
      { 
        error: 'processing_error',
        message: 'Failed to process the request',
        idempotencyKey,
      },
      { status: 500 }
    );
  }
});
