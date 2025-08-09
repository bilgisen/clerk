import { NextResponse } from 'next/server'
import { withGithubOidc, AuthedRequest } from '@/lib/middleware/withGithubOidc'

// Basic in-memory idempotency cache (replace with persistent store in production)
// Keeps last N keys with timestamps
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000 // 10 minutes
const MAX_CACHE = 500
const cache = new Map<string, { at: number }>()

function gcCache() {
  const now = Date.now()
  for (const [k, v] of cache) {
    if (now - v.at > IDEMPOTENCY_TTL_MS) cache.delete(k)
  }
  // Simple bound
  if (cache.size > MAX_CACHE) {
    const keys = Array.from(cache.keys())
    const excess = cache.size - MAX_CACHE
    for (let i = 0; i < excess; i++) cache.delete(keys[i])
  }
}

function readJsonSafe(body: ReadableStream<Uint8Array> | null): Promise<any> {
  if (!body) return Promise.resolve(undefined)
  return new Response(body).json().catch(() => undefined)
}

export const POST = withGithubOidc(async (req: AuthedRequest) => {
  // Enforce JSON content-type
  const ct = req.headers.get('content-type') || ''
  if (!ct.includes('application/json')) {
    return NextResponse.json({ error: 'invalid_content_type' }, { status: 415 })
  }

  // Idempotency
  const idem = req.headers.get('idempotency-key') || ''
  if (!idem) {
    return NextResponse.json({ error: 'missing_idempotency_key' }, { status: 400 })
  }
  gcCache()
  if (cache.has(idem)) {
    return NextResponse.json({ status: 'duplicate', idempotencyKey: idem }, { status: 200 })
  }

  const body = await readJsonSafe(req.body)
  const contentId = typeof body?.contentId === 'string' ? body.contentId : undefined
  const mode = typeof body?.mode === 'string' ? body.mode : 'default'
  if (!contentId || !/^[a-zA-Z0-9_\-\/\.]{1,200}$/.test(contentId)) {
    return NextResponse.json({ error: 'invalid_content_id' }, { status: 400 })
  }

  // TODO: trigger real job (e.g., enqueue a background task)
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  cache.set(idem, { at: Date.now() })

  // Minimal response; do not leak token/claims, but include repo/ref for observability
  const repo = req.claims?.repository
  const ref = req.claims?.ref
  const workflow = req.claims?.workflow

  return NextResponse.json(
    { accepted: true, jobId, contentId, mode, repo, ref, workflow },
    { status: 202 },
  )
})
