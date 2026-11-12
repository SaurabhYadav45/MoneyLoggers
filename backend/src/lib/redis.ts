import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

let redis: Redis | null = null;
const redisUrl = process.env.REDIS_URL;

if (redisUrl) {
  try {
    redis = new Redis(redisUrl, {
      family: 4, // Force IPv4 to avoid ENOTFOUND / ETIMEDOUT on dual-stack / NAT64 networks
      connectTimeout: 10000,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) {
          console.warn('[Redis] Max retries reached. Running without Redis cache.');
          return null; // Stop retrying
        }
        return Math.min(times * 200, 2000);
      },
    });

    redis.on('connect', () => {
      console.log('⚡ Connected to Upstash Redis');
    });

    redis.on('error', (err) => {
      console.warn('⚠️ [Redis Warning]:', err.message);
    });
  } catch (error: any) {
    console.warn('⚠️ [Redis Init Warning]:', error.message);
  }
} else {
  console.log('ℹ️ No REDIS_URL provided. Running in non-cached mode.');
}

// In-memory L1 Cache to provide instant 0ms responses and shield Redis & Database
interface MemoryCacheEntry {
  value: any;
  expiry: number;
}
const memoryCache = new Map<string, MemoryCacheEntry>();

// Garbage collect expired entries in memory every 60 seconds (unref'd so it does not hold the process open)
const gcInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (now > entry.expiry) {
      memoryCache.delete(key);
    }
  }
}, 60000);
if (gcInterval.unref) {
  gcInterval.unref();
}

/**
 * Fetch cached data (L1 Memory Cache -> L2 Redis).
 * Returns null if not cached or both caches miss.
 */
export const getCache = async <T>(key: string): Promise<T | null> => {
  const now = Date.now();
  // 1. Check L1 Memory Cache (0ms)
  const mem = memoryCache.get(key);
  if (mem) {
    if (now < mem.expiry) {
      return mem.value as T;
    }
    memoryCache.delete(key);
  }

  // 2. Check L2 Upstash Redis
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;

    // Populate L1 cache with remaining time (default to min 60s)
    const ttlSeconds = await redis.ttl(key).catch(() => 60);
    const validTtl = ttlSeconds > 0 ? ttlSeconds : 60;
    memoryCache.set(key, {
      value: parsed,
      expiry: Date.now() + validTtl * 1000
    });

    return parsed;
  } catch (err) {
    return null;
  }
};

/**
 * Store data in L1 Memory Cache & L2 Redis with a TTL in seconds.
 */
export const setCache = async (key: string, value: any, ttlSeconds: number = 300): Promise<void> => {
  // 1. Set in L1 Memory Cache immediately
  memoryCache.set(key, {
    value,
    expiry: Date.now() + ttlSeconds * 1000
  });

  // 2. Set in L2 Upstash Redis asynchronously
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    // Fail silently so DB or external API flow is never broken
  }
};

/**
 * Invalidate a key in both Memory Cache and Redis.
 */
export const deleteCache = async (key: string): Promise<void> => {
  memoryCache.delete(key);
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (err) {
    // Fail silently
  }
};

/**
 * Invalidate all keys matching a pattern in both Memory Cache and Redis.
 */
export const deleteCachePattern = async (pattern: string): Promise<void> => {
  // Convert glob pattern to regex for in-memory cache
  const regexPattern = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  for (const key of Array.from(memoryCache.keys())) {
    if (regexPattern.test(key)) {
      memoryCache.delete(key);
    }
  }

  if (!redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys && keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    // Fail silently
  }
};

/**
 * Atomically increment a counter in Redis (or L1 memory if Redis unavailable).
 * Optionally sets expiration on initial creation.
 */
export const incrCache = async (key: string, ttlSeconds: number = 86400): Promise<number> => {
  if (redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1 && ttlSeconds > 0) {
        await redis.expire(key, ttlSeconds);
      }
      return count;
    } catch (err) {
      // Fallback to memory below if Redis fails
    }
  }

  // L1 Memory fallback counter
  const mem = memoryCache.get(key);
  const now = Date.now();
  let currentVal = 0;
  if (mem && now < mem.expiry) {
    currentVal = typeof mem.value === 'number' ? mem.value : parseInt(String(mem.value), 10) || 0;
  }
  const nextVal = currentVal + 1;
  memoryCache.set(key, {
    value: nextVal,
    expiry: now + ttlSeconds * 1000
  });
  return nextVal;
};

/**
 * Get raw integer counter without incrementing.
 */
export const getCounter = async (key: string): Promise<number> => {
  if (redis) {
    try {
      const val = await redis.get(key);
      return val ? parseInt(val, 10) || 0 : 0;
    } catch {
      // Fallback to memory
    }
  }
  const mem = memoryCache.get(key);
  if (mem && Date.now() < mem.expiry) {
    return typeof mem.value === 'number' ? mem.value : parseInt(String(mem.value), 10) || 0;
  }
  return 0;
};

/**
 * Clear in-memory cache completely (useful for tests and resets).
 */
export const clearMemoryCache = (): void => {
  memoryCache.clear();
};

/**
 * Disconnect Redis client cleanly (useful for teardown in tests).
 */
export const disconnectRedis = async (): Promise<void> => {
  if (redis) {
    try {
      redis.disconnect();
    } catch {
      // ignore
    }
  }
};

export default redis;
