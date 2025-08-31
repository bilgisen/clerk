import { NextResponse } from 'next/server';

type SuccessResponse<T = any> = {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
};

type ErrorResponse = {
  success: false;
  error: string;
  details?: any;
};

export function success<T = any>(
  data: T,
  meta?: SuccessResponse['meta'],
  status = 200
): NextResponse<SuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(meta && { meta }),
    },
    { status }
  );
}

export function error(
  message: string,
  status = 400,
  details?: any
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(details && { details }),
    },
    { status }
  );
}

export function notFound(message = 'Resource not found') {
  return error(message, 404);
}

export function unauthorized(message = 'Unauthorized') {
  return error(message, 401);
}

export function forbidden(message = 'Forbidden') {
  return error(message, 403);
}

export function serverError(message = 'Internal Server Error') {
  return error(message, 500);
}
