import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { isClerkAuthContext } from '@/lib/middleware/withAuth';

export const GET = withAuth(async (request, context, auth) => {
  // Handle Clerk auth context
  if (isClerkAuthContext(auth)) {
    return NextResponse.json({
      success: true,
      message: 'Clerk authentication successful',
      user: {
        id: auth.userId,
        email: auth.email,
        name: [auth.firstName, auth.lastName].filter(Boolean).join(' ').trim(),
        type: auth.type,
        firstName: auth.firstName,
        lastName: auth.lastName,
        imageUrl: auth.imageUrl,
      },
    });
  }

  // Handle GitHub auth context
  return NextResponse.json({
    success: true,
    message: 'GitHub OIDC authentication successful',
    user: {
      id: auth.userId,
      email: auth.email,
      type: auth.type,
      // Add any GitHub-specific fields here
    },
  });
});

export const POST = withAuth(async (request, context, auth) => {
  // Example of checking resource ownership
  const resourceOwnerId = 'some-resource-id'; // In a real app, this would come from the request
  const hasAccess = auth.userId === resourceOwnerId; // Simplified check
  
  // Prepare response data based on auth type
  const response = {
    success: true,
    message: 'Resource access checked',
    hasAccess,
    userId: auth.userId,
    resourceOwnerId,
    authType: auth.type,
  };

  // Add Clerk-specific fields if available
  if (isClerkAuthContext(auth)) {
    Object.assign(response, {
      userDetails: {
        firstName: auth.firstName,
        lastName: auth.lastName,
        imageUrl: auth.imageUrl,
      }
    });
  }
  
  return NextResponse.json(response);
});
