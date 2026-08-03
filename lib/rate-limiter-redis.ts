import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export async function checkRateLimit(
  identifier: string, 
  config: RateLimitConfig = { windowMs: 60000, maxRequests: 30 }
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `ratelimit:${identifier}`;
  
  try {
    const current = await redis.get(key);
    const count = current ? parseInt(current) : 0;

    if (count >= config.maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    const pipeline = redis.multi();
    pipeline.incr(key);
    pipeline.expire(key, Math.ceil(config.windowMs / 1000));
    await pipeline.exec();

    return { allowed: true, remaining: config.maxRequests - (count + 1) };
  } catch (error) {
    console.error('Redis error:', error);
    return { allowed: true, remaining: config.maxRequests };
  }
}
