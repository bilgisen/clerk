import { 
  PublishSession, 
  PublishStatus, 
  updateSession, 
  createSession, 
  getSession 
} from './store/redis';
import { v4 as uuidv4 } from 'uuid';

export interface SessionInitParams {
  userId: string;
  contentId: string;
  nonce?: string;
  gh?: {
    repository?: string;
    run_id?: string;
    run_number?: string;
    workflow?: string;
    sha?: string;
  };
  metadata?: Record<string, unknown>;
}

export async function initializePublishSession(params: SessionInitParams): Promise<PublishSession> {
  const sessionId = `sess_${uuidv4()}`;
  const nonce = params.nonce || uuidv4();
  const now = Date.now();
  
  const session = await createSession({
    id: sessionId,
    userId: params.userId,
    nonce,
    status: 'pending-runner',
    contentId: params.contentId,
    gh: params.gh,
    metadata: params.metadata || {},
    // Add required timestamps
    createdAt: now,
    updatedAt: now
  });

  if (!session) {
    throw new Error('Failed to initialize publish session');
  }

  return session;
}

export async function updatePublishProgress(
  sessionId: string,
  progress: number,
  message?: string,
  phase?: string
): Promise<PublishSession | null> {
  // Get current session to preserve existing metadata
  const currentSession = await getSession(sessionId);
  
  const update: Parameters<typeof updateSession>[1] = {
    progress: Math.min(100, Math.max(0, progress)),
    ...(message && { message }),
    ...(phase && { phase }),
    // Preserve existing metadata if any
    ...(currentSession?.metadata && { metadata: currentSession.metadata })
  };
  
  return updateSession(sessionId, update);
}

export async function completePublishSession(
  sessionId: string,
  result: Record<string, unknown>,
  message = 'Publish completed successfully'
): Promise<PublishSession | null> {
  return updateSession(sessionId, {
    status: 'completed',
    result,
    message,
    progress: 100,
    // Store completedAt in metadata since it's not in SessionUpdateData
    metadata: { completedAt: Date.now() },
  });
}

export async function failPublishSession(
  sessionId: string,
  error: Error | string,
  message = 'Publish failed'
): Promise<PublishSession | null> {
  const errorObj = typeof error === 'string' 
    ? { message: error } 
    : { 
        message: error.message, 
        name: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };

  return updateSession(sessionId, {
    status: 'failed',
    error: {
      ...errorObj,
      code: 'PUBLISH_FAILED',
    },
    message,
    // Store completedAt in metadata since it's not in SessionUpdateData
    metadata: { 
      completedAt: Date.now(),
      ...(await getSession(sessionId).then(s => s?.metadata) || {})
    }
  });
}

export function validateSessionTransition(
  currentStatus: PublishStatus,
  newStatus: PublishStatus
): boolean {
  const validTransitions: Record<PublishStatus, PublishStatus[]> = {
    'pending-runner': ['runner-attested', 'failed', 'aborted'],
    'runner-attested': ['processing', 'failed', 'aborted'],
    'processing': ['completed', 'failed', 'aborted'],
    'completed': [],
    'failed': [],
    'aborted': []
  };

  return validTransitions[currentStatus].includes(newStatus);
}

export async function safelyUpdateSessionStatus(
  sessionId: string,
  newStatus: PublishStatus,
  message?: string
): Promise<PublishSession | null> {
  const session = await getSession(sessionId);
  if (!session) return null;

  if (!validateSessionTransition(session.status, newStatus)) {
    throw new Error(`Invalid status transition from ${session.status} to ${newStatus}`);
  }

  const update: Parameters<typeof updateSession>[1] = {
    status: newStatus,
    ...(message && { message }),
    // Preserve existing metadata
    metadata: {
      ...session.metadata,
      // Store completedAt in metadata for terminal states
      ...((newStatus === 'completed' || newStatus === 'failed' || newStatus === 'aborted') && {
        completedAt: Date.now()
      })
    }
  };

  return updateSession(sessionId, update);
}
