import { NextRequest, NextResponse } from 'next/server';
import authClient from '@/lib/auth/auth-client';
import { rateLimit, getClientIp } from '@/lib/redis/rate-limit';

type Handler = (req: NextRequest, context: { params: any, user?: any }) => Promise<NextResponse>;

/**
 * Middleware to protect API routes with authentication
 */
export function withAuth(handler: Handler) {
  return async (req: NextRequest, context: { params: any }) => {
    try {
      // Get the authenticated user from the auth client
      const { data: session } = await authClient.getSession({ required: true });
      const user = session?.user;
      
      if (!user) {
        return NextResponse.json(
          { 
            error: 'Unauthorized',
            message: 'You must be signed in to access this resource'
          },
          { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // Pass the user to the handler via context
      const response = await handler(req, { ...context, user });
      return response;
      
    } catch (error) {
      console.error('API Error:', error);
      return NextResponse.json(
        { 
          error: 'Internal Server Error',
          message: 'An unexpected error occurred'
        },
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  };
}

export function withValidation(schema: any, handler: Handler) {
  return async (req: NextRequest, context: { params: any }) => {
    try {
      let data;
      if (req.method !== 'GET') {
        data = await req.json();
        const validation = schema.safeParse(data);
        if (!validation.success) {
          return NextResponse.json(
            { error: 'Validation failed', details: validation.error.format() },
            { status: 400 }
          );
        }
      }
      return handler(req, context);
    } catch (error) {
      console.error('Validation Error:', error);
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }
  };
}

export function withRateLimit(handler: Handler, options: { max: number; windowMs: number; keyPrefix?: string }) {
  return async (req: NextRequest, context: { params: any }) => {
    try {
      const ip = getClientIp(req);
      const key = `${options.keyPrefix || 'api'}:${ip}`;
      
      const limit = await rateLimit(key, options.max, options.windowMs);
      
      if (!limit.isAllowed) {
        const response = new NextResponse(
          JSON.stringify({ 
            success: false, 
            error: 'Too many requests, please try again later.' 
          }),
          { status: 429 }
        );
        
        response.headers.set('X-RateLimit-Limit', options.max.toString());
        response.headers.set('X-RateLimit-Remaining', limit.remaining.toString());
        response.headers.set('X-RateLimit-Reset', limit.reset.toString());
        
        return response;
      }
      
      const response = await handler(req, context);
      
      // Add rate limit headers to successful responses
      response.headers.set('X-RateLimit-Limit', options.max.toString());
      response.headers.set('X-RateLimit-Remaining', limit.remaining.toString());
      response.headers.set('X-RateLimit-Reset', limit.reset.toString());
      
      return response;
    } catch (error) {
      console.error('Rate limit error:', error);
      // If Redis fails, we'll allow the request to proceed
      return handler(req, context);
    }
  };
}
