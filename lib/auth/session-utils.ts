import { Redis } from 'ioredis';
import { getRedisClient } from '../redis/client';
import { logger } from '../logger';

export interface SessionData {
  id: string;
  userId: string;
  githubToken?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  expiresAt: number;
}

const SESSION_PREFIX = 'session:';
const SESSION_TTL = 15 * 60; // 15 minutes in seconds

export async function createSession(userId: string, metadata: Record<string, unknown> = {}): Promise<SessionData> {
  const redis = getRedisClient();
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  const now = Math.floor(Date.now() / 1000);
  
  const sessionData: SessionData = {
    id: sessionId,
    userId,
    metadata,
    createdAt: now,
    expiresAt: now + SESSION_TTL
  };

  try {
    await redis.set(
      `${SESSION_PREFIX}${sessionId}`,
      JSON.stringify(sessionData),
      'EX',
      SESSION_TTL
    );
    
    return sessionData;
  } catch (error) {
    logger.error('Failed to create session', { error });
    throw new Error('Failed to create session');
  }
}

export async function getSession(sessionId: string): Promise<SessionData | null> {
  const redis = getRedisClient();
  
  try {
    const sessionData = await redis.get(`${SESSION_PREFIX}${sessionId}`);
    if (!sessionData) return null;
    
    return JSON.parse(sessionData) as SessionData;
  } catch (error) {
    logger.error('Failed to get session', { sessionId, error });
    return null;
  }
}

export async function updateSession(
  sessionId: string, 
  updates: Partial<Omit<SessionData, 'id' | 'createdAt'>>
): Promise<SessionData | null> {
  const redis = getRedisClient();
  
  try {
    const session = await getSession(sessionId);
    if (!session) return null;
    
    const updatedSession = {
      ...session,
      ...updates,
      id: sessionId,
      createdAt: session.createdAt
    };
    
    const ttl = await redis.ttl(`${SESSION_PREFIX}${sessionId}`);
    
    await redis.set(
      `${SESSION_PREFIX}${sessionId}`,
      JSON.stringify(updatedSession),
      'EX',
      ttl > 0 ? ttl : SESSION_TTL
    );
    
    return updatedSession;
  } catch (error) {
    logger.error('Failed to update session', { sessionId, error });
    return null;
  }
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  const redis = getRedisClient();
  
  try {
    const result = await redis.del(`${SESSION_PREFIX}${sessionId}`);
    return result > 0;
  } catch (error) {
    logger.error('Failed to delete session', { sessionId, error });
    return false;
  }
}

export async function cleanupExpiredSessions(): Promise<{ deleted: number; errors: number }> {
  const redis = getRedisClient();
  let cursor = '0';
  let deleted = 0;
  let errors = 0;
  
  try {
    do {
      // Use SCAN to find session keys in batches
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        `${SESSION_PREFIX}*`
      );
      
      cursor = nextCursor;
      
      // Process each key to check TTL
      for (const key of keys) {
        try {
          const ttl = await redis.ttl(key);
          if (ttl === -2) { // Key no longer exists
            continue;
          }
          
          if (ttl === -1) { // Key exists but has no TTL, delete it
            await redis.del(key);
            deleted++;
          }
        } catch (error) {
          logger.error(`Error checking key ${key}`, { error });
          errors++;
        }
      }
    } while (cursor !== '0');
    
    return { deleted, errors };
  } catch (error) {
    logger.error('Error during session cleanup', { error });
    throw error;
  }
}
