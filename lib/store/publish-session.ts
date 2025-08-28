import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

export interface PublishSession {
  id: string;
  userId: string;
  contentId: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  createdAt: number;
  updatedAt: number;
  githubRunId?: string;
  error?: string;
  downloadUrl?: string;
}

export class PublishSessionStore {
  private redis: Redis;
  private prefix = 'publish';
  private ttl = 24 * 60 * 60; // 24 hours

  constructor(redis: Redis) {
    this.redis = redis;
  }

  private getKey(sessionId: string): string {
    return `${this.prefix}:${sessionId}`;
  }

  async createSession(userId: string, contentId: string): Promise<PublishSession> {
    const session: PublishSession = {
      id: uuidv4(),
      userId,
      contentId,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.redis.set(
      this.getKey(session.id),
      JSON.stringify(session),
      'EX',
      this.ttl
    );

    return session;
  }

  async getSession(sessionId: string): Promise<PublishSession | null> {
    const data = await this.redis.get(this.getKey(sessionId));
    return data ? JSON.parse(data) : null;
  }

  async updateSession(
    sessionId: string,
    updates: Partial<Omit<PublishSession, 'id' | 'userId' | 'contentId' | 'createdAt'>>
  ): Promise<PublishSession | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    const updatedSession = {
      ...session,
      ...updates,
      updatedAt: Date.now(),
    };

    await this.redis.set(
      this.getKey(sessionId),
      JSON.stringify(updatedSession),
      'EX',
      this.ttl
    );

    return updatedSession;
  }

  async setGenerating(sessionId: string, githubRunId: string): Promise<boolean> {
    const result = await this.updateSession(sessionId, {
      status: 'generating',
      githubRunId,
    });
    return !!result;
  }

  async setCompleted(sessionId: string, downloadUrl: string): Promise<boolean> {
    const result = await this.updateSession(sessionId, {
      status: 'completed',
      downloadUrl,
    });
    return !!result;
  }

  async setFailed(sessionId: string, error: string): Promise<boolean> {
    const result = await this.updateSession(sessionId, {
      status: 'failed',
      error,
    });
    return !!result;
  }

  async getUserSessions(userId: string): Promise<PublishSession[]> {
    // Note: This is a simplified implementation
    // In production, you'd want to use a proper index
    const keys = await this.redis.keys(`${this.prefix}:*`);
    const sessions = await Promise.all(
      keys.map(async (key) => {
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
      })
    );
    
    return sessions.filter(
      (s): s is PublishSession => 
        s !== null && s.userId === userId
    );
  }
}

// Singleton instance
export let publishSessionStore: PublishSessionStore;

export function initPublishSessionStore(redis: Redis) {
  publishSessionStore = new PublishSessionStore(redis);
  return publishSessionStore;
}
