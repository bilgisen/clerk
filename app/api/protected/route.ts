import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  // Get user ID from headers set by our middleware
  const userId = request.headers.get('x-user-id');
  
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    message: "This is a JWT protected route",
    userId,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  // Get user ID from headers set by our middleware
  const userId = request.headers.get('x-user-id');
  
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Get request body
  const body = await request.json();

  return NextResponse.json({
    message: "Protected POST endpoint accessed successfully",
    userId,
    data: body,
    timestamp: new Date().toISOString(),
  });
}
