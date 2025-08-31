import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ isAllowed: boolean; remaining: number; reset: number }> {
  const keyName = `rate-limit:${key}`;
  const current = await redis.incr(keyName);
  
  if (current === 1) {
    await redis.pexpire(keyName, windowMs);
  }
  
  const ttl = await redis.pttl(keyName);
  
  return {
    isAllowed: current <= limit,
    remaining: Math.max(0, limit - current),
    reset: Math.ceil((Date.now() + ttl) / 1000),
  };
}

export function getClientIp(req: Request): string {
  const xForwardedFor = req.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }
  
  return '127.0.0.1';
}
