// app/api/ci/process/route.ts
import { NextResponse } from 'next/server';
import { 
  withSessionAuth, 
  type SessionAuthContext, 
  isSessionAuthContext,
  type AuthContextUnion,
  type UnauthorizedContext
} from '@/middleware/auth';
import type { NextRequest } from 'next/server';

// The auth context is passed in the handler context, not on the request

interface ProcessRequest {
  contentId: string;
  mode?: string;
}

// Basic in-memory idempotency cache (replace with Redis in production)
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE = 500;
const cache = new Map<string, { at: number }>();

// Simple cache garbage collection
function gcCache() {
  const now = Date.now();
  // Use forEach instead of for...of for better compatibility
  cache.forEach(({ at }, key) => {
    if (now - at > IDEMPOTENCY_TTL_MS) {
      cache.delete(key);
    }
  });
  
  // If cache is too big, delete the oldest entries
  if (cache.size > MAX_CACHE) {
    const entries = Array.from(cache.entries())
      .sort((a, b) => a[1].at - b[1].at);
    entries.slice(0, Math.floor(MAX_CACHE * 0.2)).forEach(([key]) => {
      cache.delete(key);
    });
  }
}

async function readJsonSafe<T>(body: ReadableStream<Uint8Array> | null): Promise<T | undefined> {
  if (!body) return undefined;
  try {
    return await new Response(body).json();
  } catch (e) {
    console.error('Failed to parse JSON body:', e);
    return undefined;
  }
}

// Mock processing function - replace with actual implementation
async function processContent({
  contentId,
  mode,
  context,
}: {
  contentId: string;
  mode: string;
  context: { userId: string };
}) {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return {
    success: true,
    contentId,
    mode,
    processedAt: new Date().toISOString(),
    context,
  };
}

// POST /api/ci/process
// Protected by session auth. Called by authenticated users to trigger content processing.
// Headers: { 
//   'Idempotency-Key': 'unique-request-id'
// }
// Body: { contentId: string, mode?: string }

interface HandlerContext {
  authContext: AuthContextUnion;
  params?: Record<string, string>;
}

export const POST = withSessionAuth(async (request: NextRequest, { authContext }: HandlerContext) => {
  if (!isSessionAuthContext(authContext)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  // Check rate limiting and idempotency
  const idempotencyKey = request.headers.get('idempotency-key');
  if (!idempotencyKey) {
    return NextResponse.json(
      { error: 'Idempotency-Key header is required' },
      { status: 400 }
    );
  }
  
  // Run garbage collection occasionally
  if (Math.random() < 0.01) {
    gcCache();
  }
  
  // Check if this is a duplicate request
  const cacheKey = idempotencyKey;
  const cached = cache.get(cacheKey);
  
  if (cached) {
    return NextResponse.json(
      { status: 'already_processed', processedAt: cached.at },
      { status: 202 }
    );
  }
  
  // Parse request body
  const body = await readJsonSafe<ProcessRequest>(request.body);
  if (!body?.contentId) {
    return NextResponse.json(
      { error: 'Missing required fields: contentId' },
      { status: 400 }
    );
  }
  
  // Store in cache
  cache.set(cacheKey, { at: Date.now() });
  
  try {
    // Process the content based on the mode
    const result = await processContent({
      contentId: body.contentId,
      mode: body.mode || 'default',
      context: {
        userId: isSessionAuthContext(authContext) ? authContext.userId : 'unknown',
      },
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error processing content:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process content', 
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
