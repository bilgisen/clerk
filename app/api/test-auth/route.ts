import { NextResponse } from 'next/server';
import { withSessionAuth } from '@/middleware/auth';

export const GET = withSessionAuth(async (request) => {
  try {
    // Get the auth context from the request
    const authContext = (request as any).authContext;
    
    if (!authContext || authContext.type !== 'session') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Return the user's information
    return NextResponse.json({
      message: 'You are authenticated!',
      user: {
        id: authContext.userId,
        email: authContext.email,
        name: authContext.name,
        role: authContext.role,
      },
    });
  } catch (error) {
    console.error('Test auth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
