import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withValidation, withRateLimit } from '@/lib/api/handler';
import { success, error } from '@/lib/api/response';
import { z } from 'zod';

// Define validation schema
const createExampleSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
});

// GET /api/example
async function getExamples(req: NextRequest) {
  // In a real implementation, you would fetch data from your database
  const examples = [
    { id: 1, title: 'Example 1' },
    { id: 2, title: 'Example 2' },
  ];
  
  return success(examples);
}

// POST /api/example
async function createExample(req: NextRequest) {
  const data = await req.json();
  // In a real implementation, you would save this to your database
  const newExample = {
    id: Date.now(),
    ...data,
    createdAt: new Date().toISOString(),
  };
  
  return success(newExample, undefined, 201);
}

// Rate limiting configuration
const rateLimitOptions = {
  max: 100, // 100 requests
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyPrefix: 'api:example'
};

// Export handlers with middleware
export const GET = withAuth(
  withRateLimit(
    getExamples,
    { ...rateLimitOptions, max: 200 } // Higher limit for GET requests
  )
);

export const POST = withAuth(
  withRateLimit(
    withValidation(createExampleSchema, createExample),
    { ...rateLimitOptions, max: 50 } // Lower limit for POST requests
  )
);
