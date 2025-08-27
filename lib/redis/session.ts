import { Redis } from '@upstash/redis';
import { logger } from '../logger';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// Session interface
export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Session TTL in seconds (15 minutes)
const SESSION_TTL = 15 * 60;

/**
 * Create a new session
 */
export const createSession = async (userId: string, metadata?: Record<string, unknown>): Promise<Session | null> => {
  if (!userId) {
    logger.warn('No user ID provided to createSession');
    return null;
  }

  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL * 1000);

  const session: Session = {
    id: sessionId,
    userId,
    expiresAt,
    metadata,
    createdAt: now,
    updatedAt: now,
  };

  try {
    // Convert dates to ISO strings for Redis storage
    const sessionForRedis = {
      ...session,
      expiresAt: session.expiresAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };

    await redis.setex(
      `session:${sessionId}`, 
      SESSION_TTL, 
      JSON.stringify(sessionForRedis)
    );

    logger.debug('Created new session', { 
      sessionId,
      userId,
      expiresAt: session.expiresAt
    });

    return session;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error creating session', { 
      error: errorMessage,
      userId,
      stack: error instanceof Error ? error.stack : undefined
    });
    return null;
  }
};

/**
 * Type guard to check if an object is a valid Session
 */
function isValidSession(obj: unknown): obj is Session {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'userId' in obj &&
    'expiresAt' in obj &&
    'createdAt' in obj &&
    'updatedAt' in obj
  );
}

/**
 * Parse session data from Redis
 */
function parseSessionData(sessionData: string | null): Session | null {
  if (!sessionData) return null;
  
  try {
    const parsed = JSON.parse(sessionData);
    
    // Convert string dates back to Date objects
    if (parsed.expiresAt) parsed.expiresAt = new Date(parsed.expiresAt);
    if (parsed.createdAt) parsed.createdAt = new Date(parsed.createdAt);
    if (parsed.updatedAt) parsed.updatedAt = new Date(parsed.updatedAt);
    
    return isValidSession(parsed) ? parsed : null;
  } catch (error) {
    logger.error('Error parsing session data', { error });
    return null;
  }
}

/**
 * Get a session by ID
 */
export const getSession = async (sessionId: string): Promise<Session | null> => {
  if (!sessionId) {
    logger.warn('No session ID provided to getSession');
    return null;
  }

  try {
    const sessionData = await redis.get<string>(`session:${sessionId}`);
    if (!sessionData) return null;
    
    const session = parseSessionData(sessionData);
    if (!session) {
      logger.warn('Invalid session data format', { sessionId });
      await redis.del(`session:${sessionId}`);
      return null;
    }
    
    // Check if session is expired
    if (session.expiresAt < new Date()) {
      logger.debug('Session expired', { sessionId, expiresAt: session.expiresAt });
      await redis.del(`session:${sessionId}`);
      return null;
    }
    
    return session;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting session', { 
      error: errorMessage,
      sessionId,
      stack: error instanceof Error ? error.stack : undefined
    });
    return null;
  }
};

/**
 * Delete a session
 */
export const deleteSession = async (sessionId: string): Promise<boolean> => {
  if (!sessionId) {
    logger.warn('No session ID provided to deleteSession');
    return false;
  }

  try {
    const result = await redis.del(`session:${sessionId}`);
    const success = result > 0;
    
    if (success) {
      logger.debug('Deleted session', { sessionId });
    } else {
      logger.warn('Session not found for deletion', { sessionId });
    }
    
    return success;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error deleting session', { 
      error: errorMessage,
      sessionId,
      stack: error instanceof Error ? error.stack : undefined
    });
    return false;
  }
};

/**
 * Update session metadata
 */
export const updateSession = async (
  sessionId: string, 
  updates: Partial<Omit<Session, 'id' | 'createdAt'>>
): Promise<Session | null> => {
  if (!sessionId) {
    logger.warn('No session ID provided to updateSession');
    return null;
  }

  try {
    const session = await getSession(sessionId);
    if (!session) {
      logger.warn('Session not found for update', { sessionId });
      return null;
    }
    
    const now = new Date();
    const updatedSession: Session = {
      ...session,
      ...updates,
      updatedAt: now,
      // Ensure we don't override these protected fields
      id: session.id,
      createdAt: session.createdAt,
    };
    
    // Convert dates to ISO strings for Redis storage
    const sessionForRedis = {
      ...updatedSession,
      expiresAt: updatedSession.expiresAt.toISOString(),
      createdAt: updatedSession.createdAt.toISOString(),
      updatedAt: updatedSession.updatedAt.toISOString(),
    };
    
    await redis.setex(
      `session:${sessionId}`, 
      SESSION_TTL, 
      JSON.stringify(sessionForRedis)
    );
    
    logger.debug('Updated session', { 
      sessionId,
      userId: updatedSession.userId,
      updates: Object.keys(updates)
    });
    
    return updatedSession;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating session', { 
      error: errorMessage,
      sessionId,
      stack: error instanceof Error ? error.stack : undefined
    });
    return null;
  }
};

/**
 * Clean up expired sessions
 * Note: In a production environment, consider using Redis SCAN with a cursor
 * for large datasets to avoid blocking the Redis server.
 * 
 * @returns An object containing the count of deleted sessions, errors encountered,
 *          and an optional error message if the operation failed.
 */
export const cleanupExpiredSessions = async (): Promise<{ 
  deleted: number; 
  errors: number; 
  error?: string 
}> => {
  const result = { deleted: 0, errors: 0 };
  
  try {
    logger.info('Starting expired sessions cleanup');
    
    // In a production environment, you would use SCAN with a cursor
    // This is a simplified version that works with small datasets
    const keys = await redis.keys('session:*');
    
    if (!keys || keys.length === 0) {
      logger.debug('No sessions found for cleanup');
      return result;
    }
    
    logger.debug(`Checking ${keys.length} sessions for expiration`);
    
    // Process sessions in batches to avoid memory issues
    const BATCH_SIZE = 100;
    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const batch = keys.slice(i, i + BATCH_SIZE);
      const sessions = await Promise.all(batch.map(key => 
        redis.get(key).then(data => ({ key, data }))
      ));
      
      // Filter out null/undefined sessions and parse them
      const validSessions = sessions
        .filter(s => s.data)
        .map(({ key, data }) => ({
          key,
          session: parseSessionData(data as string)
        }))
        .filter(({ session }) => session !== null) as Array<{
          key: string;
          session: Session;
        }>;
      
      // Find expired sessions
      const now = new Date();
      const expiredSessions = validSessions.filter(
        ({ session }) => new Date(session.expiresAt) < now
      );
      
      if (expiredSessions.length === 0) {
        continue;
      }
      
      // Delete expired sessions
      const deleteResults = await Promise.allSettled(
        expiredSessions.map(({ key }) => redis.del(key))
      );
      
      // Count results
      const batchResult = {
        deleted: deleteResults.filter(r => r.status === 'fulfilled' && r.value > 0).length,
        errors: deleteResults.filter(r => r.status === 'rejected').length
      };
      
      result.deleted += batchResult.deleted;
      result.errors += batchResult.errors;
      
      logger.debug(`Processed batch ${i / BATCH_SIZE + 1}:`, {
        total: batch.length,
        expired: expiredSessions.length,
        deleted: batchResult.deleted,
        errors: batchResult.errors
      });
      
      // Small delay to avoid overwhelming Redis
      if (i + BATCH_SIZE < keys.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    logger.info('Completed expired sessions cleanup', result);
    return result;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error during session cleanup', { 
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Return partial results if available
    return { ...result, error: errorMessage };
  }
};
