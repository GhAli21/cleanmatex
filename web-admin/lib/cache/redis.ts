/**
 * Redis Cache Client
 * 
 * Provides Redis connection and caching utilities for the application.
 * Used for permission caching, session management, and other caching needs.
 * 
 * NOTE: This module is server-only. Do not import in client components.
 */

import 'server-only';
import Redis from 'ioredis';

// Redis client instance (singleton)
let redisClient: Redis | null = null;

/**
 * Get or create Redis client instance
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: false,
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
      // Don't throw - allow fallback to database
    });

    redisClient.on('connect', () => {
      console.log('Redis Client Connected');
    });
  }

  return redisClient;
}

/**
 * Check if Redis is available
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    const client = getRedisClient();
    await client.ping();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

/**
 * Cache utility functions
 */
export const cache = {
  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (!(await isRedisAvailable())) {
        return null;
      }

      const client = getRedisClient();
      const value = await client.get(key);
      
      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Cache get error:', error);
      return null; // Fail gracefully - fallback to database
    }
  },

  /**
   * Set value in cache with TTL
   */
  async set<T>(key: string, value: T, ttlSeconds: number = 900): Promise<boolean> {
    try {
      if (!(await isRedisAvailable())) {
        return false;
      }

      const client = getRedisClient();
      await client.setex(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false; // Fail gracefully
    }
  },

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<boolean> {
    try {
      if (!(await isRedisAvailable())) {
        return false;
      }

      const client = getRedisClient();
      await client.del(key);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  },

  /**
   * Delete multiple keys matching pattern
   */
  async delPattern(pattern: string): Promise<number> {
    try {
      if (!(await isRedisAvailable())) {
        return 0;
      }

      const client = getRedisClient();
      const keys = await client.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }

      await client.del(...keys);
      return keys.length;
    } catch (error) {
      console.error('Cache delete pattern error:', error);
      return 0;
    }
  },

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      if (!(await isRedisAvailable())) {
        return false;
      }

      const client = getRedisClient();
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  },

  /**
   * Get TTL for a key
   */
  async ttl(key: string): Promise<number> {
    try {
      if (!(await isRedisAvailable())) {
        return -1;
      }

      const client = getRedisClient();
      return await client.ttl(key);
    } catch (error) {
      console.error('Cache TTL error:', error);
      return -1;
    }
  },
};

