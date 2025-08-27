import Redis from "ioredis";
import {
  SessionCreateData,
  SessionUpdateData,
  SessionListResult,
  SessionFilterOptions,
} from "./types";

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
  | "pending-runner" 
  | "runner-attested" 
  | "processing"
  | "completed" 
  | "aborted" 
  | "failed";

export interface PublishSession extends SessionCreateData {
  id: string;
  userId: string;
  nonce: string;
  status: PublishStatus;
  contentId: string;
  progress?: number;
  message?: string;
  phase?: string;
  gh?: {
    repository?: string;
    run_id?: string;
    run_number?: string;
    workflow?: string;
    sha?: string;
  };
  combinedToken?: string;
  completedAt?: number;
  result?: Record<string, unknown>;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

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
  const now = Date.now();
  const sessionWithTimestamps = {
    ...session,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await redis.set(
      getKey(session.id),
      JSON.stringify(sessionWithTimestamps),
      "EX",
      getTtl(session.status)
    );
    return sessionWithTimestamps;
  } catch (error) {
    console.error("Error creating session:", error);
    return null;
  }
}

export async function getSession(id: string): Promise<PublishSession | null> {
  try {
    const data = await redis.get(getKey(id));
    if (!data) return null;
    
    const session = JSON.parse(data) as PublishSession;
    return session;
  } catch (error) {
    console.error("Error getting session:", error);
    return null;
  }
}

export async function updateSession(
  id: string,
  updates: SessionUpdateData
): Promise<PublishSession | null> {
  const existing = await getSession(id);
  if (!existing) return null;

  const updated = {
    ...existing,
    ...updates,
    updatedAt: Date.now(),
  } as PublishSession;

  try {
    await redis.set(
      getKey(id),
      JSON.stringify(updated),
      "EX",
      getTtl(updates.status || existing.status)
    );
    return updated;
  } catch (error) {
    console.error("Error updating session:", error);
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
      if (data) {
        const session = JSON.parse(data) as PublishSession;
        if (session.userId === userId && session.status !== "completed") {
          sessions.push(session);
        }
      }
    }
  
    return sessions;
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

    // Get all sessions
    const sessionsRaw = await redis.mget(...keys);
    let sessions = sessionsRaw
      .map((data) => (data ? (JSON.parse(data) as PublishSession) : null))
      .filter((session): session is PublishSession => 
        session !== null && session.userId === userId
      );

    // Apply filters
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
      total 
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
