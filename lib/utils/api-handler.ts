import type { NextRequest } from 'next/server';
import { z, type ZodType, type ZodObject } from 'zod';
import { fromZodError } from 'zod-validation-error';

type ApiHandlerOptions<TParams extends ZodObject<any>, TBody extends ZodType | undefined> = {
  paramsSchema: TParams;
  bodySchema?: TBody;
  handler?: (context: {
    request: NextRequest;
    params: z.infer<TParams>;
    body: TBody extends ZodType ? z.infer<TBody> : undefined;
  }) => Promise<Response> | Response;
};

export function createApiHandler<
  TParams extends ZodObject<any>,
  TBody extends ZodType | undefined = undefined
>(
  options: ApiHandlerOptions<TParams, TBody>
) {
  const handleRequest = async (
    method: string,
    request: NextRequest,
    rawParams: unknown
  ): Promise<Response> => {
    try {
      // Validate route parameters
      const params = options.paramsSchema.safeParse(rawParams);
      if (!params.success) {
        return errorResponse(400, 'Invalid parameters', fromZodError(params.error).message);
      }

      // Parse request body if needed
      let body: any;
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

      // If a custom handler is provided, use it
      if (options.handler) {
        return options.handler({
          request,
          params: params.data,
          body,
        });
      }

      // Default response if no handler is provided
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            params: params.data,
            ...(body && { body }),
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      console.error(`[API Error] ${method} ${request.url}`, error);
      return errorResponse(500, 'Internal server error');
    }
  };

  return {
    async GET(request: NextRequest, context: { params: unknown }): Promise<Response> {
      return handleRequest('GET', request, context.params);
    },
    async POST(request: NextRequest, context: { params: unknown }): Promise<Response> {
      return handleRequest('POST', request, context.params);
    },
    async PUT(request: NextRequest, context: { params: unknown }): Promise<Response> {
      return handleRequest('PUT', request, context.params);
    },
    async PATCH(request: NextRequest, context: { params: unknown }): Promise<Response> {
      return handleRequest('PATCH', request, context.params);
    },
    async DELETE(request: NextRequest, context: { params: unknown }): Promise<Response> {
      return handleRequest('DELETE', request, context.params);
    },
  };
}


function errorResponse(status: number, message: string, details?: string): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      ...(details && { details }),
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
