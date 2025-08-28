import { auth } from '@clerk/nextjs/server';
import { v4 as uuidv4 } from 'uuid';
import { generateCombinedToken, verifyCombinedToken, CombinedTokenPayload } from './combined-token';
import { createSession, getSession, PublishStatus } from '@/lib/store/redis';

interface CreateUserTokenParams {
  contentId: string;
  permissions?: {
    can_publish?: boolean;
    can_generate?: boolean;
    can_manage?: boolean;
  };
  metadata?: Record<string, unknown>;
}

export async function createUserToken(params: CreateUserTokenParams): Promise<string> {
  try {
    const authObj = await auth();
    const userId = authObj.userId;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    const sessionId = `sess_${uuidv4()}`;
    const nonce = uuidv4();

    // Create a Redis session
    await createSession({
      id: sessionId,
      userId,
      contentId: params.contentId,
      nonce,
      status: 'pending-runner',
      metadata: params.metadata || {},
      message: 'Token created',
      progress: 0,
      phase: 'initializing',
      gh: {
        // GitHub-related fields can be added here if needed
      }
    });

    // Generate a combined token with permissions in the payload
    return generateCombinedToken(
      {
        sessionId,
        userId,
        contentId: params.contentId,
        nonce,
        tokenType: 'user',
        metadata: {
          ...params.metadata,
          permissions: {
            can_publish: params.permissions?.can_publish ?? false,
            can_generate: params.permissions?.can_generate ?? false,
            can_manage: params.permissions?.can_manage ?? false,
          },
          status: 'pending-runner'
        }
      },
      process.env.COMBINED_JWT_AUDIENCE || 'clerk-actions',
      '1h' // Token expires in 1 hour
    );
  } catch (error) {
    console.error('Error creating user token:', error);
    throw error;
  }
}

interface VerifyTokenResult {
  isValid: boolean;
  payload?: CombinedTokenPayload;
  error?: string;
}

export async function verifyToken(token: string, audience: string = 'default-audience'): Promise<VerifyTokenResult> {
  try {
    // Verify the token signature and basic claims
    const payload = await verifyCombinedToken(token, audience);
    
    if (!payload) {
      return {
        isValid: false,
        error: 'Invalid token payload',
      };
    }

    // Additional verification with Redis session store
    const sessionId = String(payload.sessionId);
    const session = await getSession(sessionId);
    if (!session) {
      return {
        isValid: false,
        error: 'Session not found',
      };
    }

    // Verify nonce matches
    if (session.nonce !== payload.nonce) {
      return {
        isValid: false,
        error: 'Invalid session nonce',
      };
    }

    // Define valid active statuses
    const ACTIVE_STATUSES: PublishStatus[] = [
      'pending-runner',
      'runner-attested',
      'processing'
    ];

    // Verify session is in a valid active state
    if (!ACTIVE_STATUSES.includes(session.status)) {
      return {
        isValid: false,
        error: `Session is not in an active state (status: ${session.status})`,
      };
    }

    // Include additional session data in the payload
    const enhancedPayload: CombinedTokenPayload & {
      sessionStatus?: string;
      sessionProgress?: number;
    } = {
      ...payload,
      sessionStatus: session.status,
      sessionProgress: session.progress,
    };

    return { 
      isValid: true, 
      payload: enhancedPayload,
    };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Invalid token',
    };
  }
}

/**
 * Check if the token has the required permission
 * @param payload The token payload to check
 * @param requiredPermission The permission to check for
 * @returns boolean indicating if the permission is granted
 */
export function checkPermissions(
  payload: CombinedTokenPayload,
  requiredPermission: keyof CombinedTokenPayload['permissions']
): boolean {
  if (!payload?.permissions) {
    return false;
  }
  return payload.permissions[requiredPermission] === true;
}

/**
 * Check if the token has all the required permissions
 * @param payload The token payload to check
 * @param requiredPermissions Array of permissions to check for
 * @returns boolean indicating if all permissions are granted
 */
export function hasAllPermissions(
  payload: CombinedTokenPayload,
  requiredPermissions: Array<keyof CombinedTokenPayload['permissions']>
): boolean {
  if (!payload?.permissions) {
    return false;
  }
  return requiredPermissions.every(perm => payload.permissions[perm] === true);
}

/**
 * Check if the token has any of the required permissions
 * @param payload The token payload to check
 * @param requiredPermissions Array of permissions to check for
 * @returns boolean indicating if any permission is granted
 */
export function hasAnyPermission(
  payload: CombinedTokenPayload,
  requiredPermissions: Array<keyof CombinedTokenPayload['permissions']>
): boolean {
  if (!payload?.permissions) {
    return false;
  }
  return requiredPermissions.some(perm => payload.permissions[perm] === true);
}
