import { Redis } from 'ioredis';

let redisClient: Redis;

export function getRedisClient(): Redis {
  if (!redisClient) {
    if (!process.env.REDIS_URL) {
      throw new Error('REDIS_URL environment variable is not set');
    }
    
    redisClient = new Redis(process.env.REDIS_URL, {
      tls: process.env.NODE_ENV === 'production' ? {} : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    redisClient.on('error', (error) => {
      console.error('Redis error:', error);
    });

    redisClient.on('connect', () => {
      console.log('Connected to Redis');
    });
  }

  return redisClient;
}

export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
  }
}
