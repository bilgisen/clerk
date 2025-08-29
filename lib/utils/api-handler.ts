import { NextRequest, NextResponse } from 'next/server';
import { z, type ZodType, type ZodObject } from 'zod';
import { fromZodError } from 'zod-validation-error';

type ApiHandlerOptions<TParams extends ZodObject<any>, TBody extends ZodType | undefined> = {
  paramsSchema: TParams;
  bodySchema?: TBody;
};

export function createApiHandler<
  TParams extends ZodObject<any>,
  TBody extends ZodType | undefined = undefined
>(
  options: ApiHandlerOptions<TParams, TBody>
) {
  return {
    async GET(request: NextRequest, context: { params: unknown }) {
      return handleRequest('GET', request, context.params, options);
    },
    async POST(request: NextRequest, context: { params: unknown }) {
      return handleRequest('POST', request, context.params, options);
    },
    async PATCH(request: NextRequest, context: { params: unknown }) {
      return handleRequest('PATCH', request, context.params, options);
    },
    async DELETE(request: NextRequest, context: { params: unknown }) {
      return handleRequest('DELETE', request, context.params, options);
    },
  };
}

async function handleRequest<TParams extends ZodObject<any>, TBody extends ZodType | undefined>(
  method: string,
  request: NextRequest,
  rawParams: unknown,
  options: {
    paramsSchema: TParams;
    bodySchema?: TBody;
  }
) {
  try {
    // Validate route parameters
    const params = options.paramsSchema.safeParse(rawParams);
    if (!params.success) {
      return errorResponse(400, 'Invalid parameters', fromZodError(params.error).message);
    }

    // Parse request body if needed
    let body: unknown;
    if (['POST', 'PATCH', 'PUT'].includes(method) && options.bodySchema) {
      try {
        const json = await request.json();
        const result = options.bodySchema.safeParse(json);
        if (!result.success) {
          return errorResponse(400, 'Invalid request body', fromZodError(result.error).message);
        }
        body = result.data;
      } catch (error) {
        return errorResponse(400, 'Invalid JSON body');
      }
    }

    return { params: params.data, body };
  } catch (error) {
    console.error(`[API Error] ${method} ${request.url}`, error);
    return errorResponse(500, 'Internal server error');
  }
}

function errorResponse(status: number, message: string, details?: string) {
  return NextResponse.json(
    { error: message, ...(details && { details }) },
    { status }
  );
}
