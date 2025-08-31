import Redis from "ioredis";
import { 
  SessionCreateData, 
  SessionUpdateData, 
  SessionListResult, 
  SessionFilterOptions,
  type PublishSession 
} from './types';

export type { PublishSession };

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL environment variable is not set");
}

// Create Redis client with enhanced configuration
const redis = new Redis(process.env.REDIS_URL, {
  // Connection retry strategy
  retryStrategy: (times) => {
    if (times > 10) {
      console.error('Max Redis reconnection attempts reached');
      return null; // Stop retrying after 10 attempts
    }
    const delay = Math.min(times * 100, 5000); // Max 5s delay
    console.warn(`Redis connection lost. Reconnecting in ${delay}ms...`);
    return delay;
  },
  
  // Enable auto-reconnect
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      // Only reconnect when the error contains "READONLY"
      return true;
    }
    return false;
  },
  
  // Connection timeout (in ms)
  connectTimeout: 10000,
  
  // Command timeout (in ms)
  commandTimeout: 5000,
  
  // Enable auto-pipelining for better performance
  enableAutoPipelining: true,
  
  // Enable TLS if using a secure connection
  tls: process.env.REDIS_URL?.startsWith('rediss://') ? {
    rejectUnauthorized: false, // Set to true in production with proper certs
  } : undefined,
});

// Error handling
redis.on('error', (error) => {
  console.error('Redis error:', error);
});

redis.on('connect', () => {
  console.log('Connected to Redis');
});

redis.on('reconnecting', () => {
  console.log('Reconnecting to Redis...');
});

redis.on('ready', () => {
  console.log('Redis client ready');
  // Don't crash the app on Redis errors
});

export type PublishStatus = 
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'publishing'
  | 'published'
  | 'pending-runner'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'aborted';

// Session expiration times (in seconds)
const SESSION_TTL = 60 * 60 * 24; // 24 hours
const COMPLETED_SESSION_TTL = 60 * 60 * 24 * 7; // 7 days for completed/failed sessions
const KEY_PREFIX = "pubsess:";

// Helper to generate Redis key
function getKey(id: string): string {
  return `${KEY_PREFIX}${id}`;
}

// Helper to get TTL based on session status
function getTtl(status: PublishStatus): number {
  return status === "completed" || status === "failed" || status === "aborted"
    ? COMPLETED_SESSION_TTL
    : SESSION_TTL;
}

export async function createSession(session: SessionCreateData): Promise<PublishSession | null> {
  try {
    const key = getKey(session.id);
    const now = Date.now();
    
    // Create a base session with required fields
    const publishSession: PublishSession = {
      id: session.id,
      userId: session.userId,
      status: session.status,
      progress: session.progress ?? 0, // Ensure progress is always a number
      createdAt: now,
      updatedAt: now,
    };
    
    // Add optional fields if they exist
    if (session.gh) {
      publishSession.gh = session.gh;
    }
    if (session.metadata) {
      publishSession.metadata = session.metadata;
    }

    await redis.set(
      key,
      JSON.stringify(publishSession),
      'EX',
      getTtl(session.status)
    );

    return publishSession;
  } catch (error) {
    console.error('Error creating session:', error);
    return null;
  }
}

export async function getSession(id: string): Promise<PublishSession | null> {
  try {
    const key = getKey(id);
    const data = await redis.get(key);
    if (!data) return null;
    
    const session = JSON.parse(data);
    // Ensure required fields are present
    if (!session.id || !session.userId || session.progress === undefined) {
      console.error('Invalid session data:', session);
      return null;
    }
    
    return session as PublishSession;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

export async function updateSession(
  id: string,
  updates: SessionUpdateData
): Promise<PublishSession | null> {
  try {
    const key = getKey(id);
    const existing = await getSession(id);
    
    if (!existing) return null;

    const updatedSession: PublishSession = {
      id: existing.id,
      userId: existing.userId,
      status: updates.status || existing.status,
      progress: updates.progress !== undefined ? updates.progress : existing.progress,
      ...(existing.gh && { gh: existing.gh }),
      ...(updates.gh && { gh: updates.gh }),
      ...(updates.metadata && { metadata: { ...existing.metadata, ...updates.metadata } }),
      updatedAt: Date.now(),
      createdAt: existing.createdAt,
    };

    await redis.set(
      key,
      JSON.stringify(updatedSession),
      'EX',
      getTtl(updates.status || existing.status)
    );

    return updatedSession;
  } catch (error) {
    console.error('Error updating session:', error);
    return null;
  }
}

export async function deleteSession(id: string): Promise<boolean> {
  try {
    const result = await redis.del(getKey(id));
    return result > 0;
  } catch (error) {
    console.error("Error deleting session:", error);
    return false;
  }
}

export async function getActiveSessions(
  userId: string
): Promise<PublishSession[]> {
  try {
    const keys = await redis.keys(`${KEY_PREFIX}*`);
    const sessions: PublishSession[] = [];
  
    for (const key of keys) {
      const data = await redis.get(key);
      if (!data) continue;
      
      try {
        const parsed = JSON.parse(data);
        
        // Skip if required fields are missing or invalid
        if (!parsed || 
            typeof parsed.id !== 'string' || 
            parsed.userId !== userId || 
            parsed.status === 'completed' ||
            typeof parsed.progress !== 'number') {
          continue;
        }
        
        // Create a new session object with all required fields
        const session: PublishSession = {
          id: parsed.id,
          userId: parsed.userId,
          status: parsed.status,
          progress: parsed.progress,
          createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now(),
          updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
          ...(parsed.gh && { gh: parsed.gh }),
          ...(parsed.metadata && { metadata: parsed.metadata })
        };
        
        sessions.push(session);
      } catch (error) {
        console.error('Error parsing session data:', error);
        continue;
      }
    }
  
    // Sort by updatedAt (newest first)
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    console.error("Error getting active sessions:", error);
    return [];
  }
}

export async function getSessionsByUser(
  userId: string,
  options: SessionFilterOptions = {}
): Promise<SessionListResult> {
  try {
    const pattern = `${KEY_PREFIX}*`;
    const keys = await redis.keys(pattern);
    
    if (keys.length === 0) {
      return { sessions: [], total: 0 };
    }
    
    const pipeline = redis.pipeline();
    keys.forEach(key => pipeline.get(key));
    const results = await pipeline.exec();
    
    if (!results) {
      return { sessions: [], total: 0 };
    }
    
    // Process and validate sessions
    let sessions = results
      .map(([err, data]) => {
        if (err || !data) return null;
        
        try {
          const parsed = JSON.parse(data as string);
          
          // Validate required fields
          if (!parsed || 
              typeof parsed.id !== 'string' || 
              parsed.userId !== userId || 
              typeof parsed.progress !== 'number' ||
              !parsed.status) {
            return null;
          }
          
          // Create a properly typed session object
          const session: PublishSession = {
            id: parsed.id,
            userId: parsed.userId,
            status: parsed.status,
            progress: parsed.progress,
            createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now(),
            updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
            ...(parsed.gh && { gh: parsed.gh }),
            ...(parsed.metadata && { metadata: parsed.metadata })
          };
          
          return session;
        } catch (error) {
          console.error('Error parsing session data:', error);
          return null;
        }
      })
      .filter((session): session is PublishSession => session !== null);
    
    // Apply status filter if provided
    if (options.status?.length) {
      sessions = sessions.filter(session => 
        options.status?.includes(session.status)
      );
    }
    
    // Sort by creation date (newest first)
    sessions.sort((a, b) => b.createdAt - a.createdAt);
    
    // Apply pagination
    const total = sessions.length;
    const offset = options.offset || 0;
    const limit = options.limit || total;
    const paginatedSessions = sessions.slice(offset, offset + limit);
    
    return {
      sessions: paginatedSessions,
      total,
    };
  } catch (error) {
    console.error("Error getting user sessions:", error);
    return { sessions: [], total: 0 };
  }
}

export async function updateSessionStatus(
  id: string, 
  status: PublishStatus,
  message?: string,
  progress?: number
): Promise<PublishSession | null> {
  const update: Partial<PublishSession> = { status };
  
  if (message !== undefined) {
    update.message = message;
  }
  
  if (progress !== undefined) {
    update.progress = progress;
  }
  
  if (status === 'completed' || status === 'failed' || status === 'aborted') {
    update.completedAt = Date.now();
  }
  
  return updateSession(id, update);
}
