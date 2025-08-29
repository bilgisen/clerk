import { NextRequest, NextResponse } from 'next/server';
import { z, type ZodType, type output, type ZodObject } from 'zod';
import { fromZodError } from 'zod-validation-error';

type HandlerResponse = NextResponse | Response;

type RouteContext<TParams, TBody> = {
  params: TParams;
  body: TBody;
};

type RouteHandlerOptions<
  TParams extends ZodObject<any>,
  TBody extends ZodType | undefined = undefined
> = {
  paramsSchema: TParams;
  bodySchema?: TBody;
  handler: (
    request: NextRequest,
    context: RouteContext<z.infer<TParams>, TBody extends ZodType ? output<TBody> : undefined>
  ) => Promise<HandlerResponse>;
  
  // Add this to make it compatible with Next.js route handler types
  GET?: (request: NextRequest, context: { params: z.infer<TParams> }) => Promise<NextResponse>;
  POST?: (request: NextRequest, context: { params: z.infer<TParams>; body: TBody extends ZodType ? output<TBody> : undefined }) => Promise<NextResponse>;
  PATCH?: (request: NextRequest, context: { params: z.infer<TParams>; body: TBody extends ZodType ? output<TBody> : undefined }) => Promise<NextResponse>;
  DELETE?: (request: NextRequest, context: { params: z.infer<TParams> }) => Promise<NextResponse>;
};

export function createRouteHandler<
  TParams extends ZodObject<any>,
  TBody extends ZodType | undefined = undefined
>(
  options: RouteHandlerOptions<TParams, TBody>
): {
  GET: (request: NextRequest, context: { params: unknown }) => Promise<NextResponse>;
  POST?: (request: NextRequest, context: { params: unknown }) => Promise<NextResponse>;
  PATCH?: (request: NextRequest, context: { params: unknown }) => Promise<NextResponse>;
  DELETE?: (request: NextRequest, context: { params: unknown }) => Promise<NextResponse>;
} {
  const handler = async (request: NextRequest, context: { params: unknown }) => {
    try {
      // Validate route parameters
      const params = options.paramsSchema.safeParse(context.params);
      if (!params.success) {
        return NextResponse.json(
          { error: 'Invalid route parameters', details: fromZodError(params.error).message },
          { status: 400 }
        );
      }

      // Validate request body if schema is provided
      let body: z.infer<TBody> | undefined;
      if (options.bodySchema) {
        const json = await request.json().catch(() => ({}));
        const validatedBody = options.bodySchema.safeParse(json);
        
        if (!validatedBody.success) {
          return NextResponse.json(
            { error: 'Invalid request body', details: fromZodError(validatedBody.error).message },
            { status: 400 }
          );
        }
        body = validatedBody.data;
      }

      // Call the handler with validated data
      const response = await options.handler(request, { 
        params: params.data, 
        body: (body ?? undefined) as TBody extends ZodType ? output<TBody> : undefined
      });
      
      if (response instanceof Response && !(response instanceof NextResponse)) {
        return new NextResponse(response.body, response);
      }
      return response;

    } catch (error) {
      console.error('Route handler error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };

  return {
    GET: handler,
    POST: handler,
    PATCH: handler,
    DELETE: handler,
  };
}
