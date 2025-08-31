import { auth } from '@/lib/auth/better-auth';
import { toNextJsHandler } from 'better-auth/next-js';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Handle all auth routes with the default handler
const { GET, POST } = toNextJsHandler(auth);

// Export the handlers directly
// The auth middleware will handle session management
// and cookie setting automatically

export { GET, POST };

// Disable caching for auth routes
export const dynamic = 'force-dynamic';
export const revalidate = 0;
