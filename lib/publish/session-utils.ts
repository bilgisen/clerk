import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

export type PublishStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface PublishSession {
  id: string;
  bookId: string;
  status: PublishStatus;
  progress: number;
  message?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const SESSION_PREFIX = 'publish:session:';
const SESSION_TTL = 60 * 60 * 24; // 24 hours

function getSessionKey(sessionId: string): string {
  return `${SESSION_PREFIX}${sessionId}`;
}

export async function initializePublishSession(bookId: string, metadata?: Record<string, unknown>): Promise<PublishSession> {
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  const now = Date.now();
  
  const session: PublishSession = {
    id: sessionId,
    bookId,
    status: 'pending',
    progress: 0,
    createdAt: now,
    updatedAt: now,
    metadata,
  };

  try {
    await redis.setex(
      getSessionKey(sessionId),
      SESSION_TTL,
      JSON.stringify(session)
    );
    return session;
  } catch (error) {
    logger.error('Failed to initialize publish session', { error, bookId });
    throw new Error('Failed to initialize publish session');
  }
}

export async function getPublishSession(sessionId: string): Promise<PublishSession | null> {
  try {
    const data = await redis.get<string>(getSessionKey(sessionId));
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Failed to get publish session', { error, sessionId });
    return null;
  }
}

export async function updatePublishProgress(
  sessionId: string,
  updates: {
    status?: PublishStatus;
    progress?: number;
    message?: string;
    error?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<PublishSession | null> {
  try {
    const session = await getPublishSession(sessionId);
    if (!session) return null;

    const updatedSession: PublishSession = {
      ...session,
      ...updates,
      updatedAt: Date.now(),
    };

    await redis.setex(
      getSessionKey(sessionId),
      SESSION_TTL,
      JSON.stringify(updatedSession)
    );

    return updatedSession;
  } catch (error) {
    logger.error('Failed to update publish session progress', { error, sessionId, updates });
    return null;
  }
}

export async function completePublishSession(sessionId: string, message?: string): Promise<boolean> {
  try {
    const updated = await updatePublishProgress(sessionId, {
      status: 'completed',
      progress: 100,
      message,
    });
    return updated !== null;
  } catch (error) {
    logger.error('Failed to complete publish session', { error, sessionId });
    return false;
  }
}

export async function failPublishSession(sessionId: string, errorMessage: string): Promise<boolean> {
  try {
    const updated = await updatePublishProgress(sessionId, {
      status: 'failed',
      error: errorMessage,
    });
    return updated !== null;
  } catch (error) {
    logger.error('Failed to fail publish session', { error, sessionId, errorMessage });
    return false;
  }
}

export async function cleanupPublishSession(sessionId: string): Promise<boolean> {
  try {
    await redis.del(getSessionKey(sessionId));
    return true;
  } catch (error) {
    logger.error('Failed to clean up publish session', { error, sessionId });
    return false;
  }
}
