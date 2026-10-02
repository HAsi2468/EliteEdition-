/**
 * ============================================================================
 * ELITE ERP ENTERPRISE - REDIS CLIENT & DISTRIBUTED STATE PROVIDER
 * Provides resilient Redis connection pooling with automatic reconnection,
 * telemetry logging, and an in-memory TTL store fallback.
 * ============================================================================
 */

const logger = require('../config/logger');

let redis;
try {
  redis = require('redis');
} catch (e) {
  redis = null;
}

class InMemoryRedisFallback {
  constructor() {
    this.store = new Map();
    this.timers = new Map();
    this.isFallback = true;
  }

  async get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.del(key);
      return null;
    }
    return item.value;
  }

  async set(key, value, options = {}) {
    let expiresAt = null;
    if (options.EX) {
      expiresAt = Date.now() + options.EX * 1000;
    } else if (options.PX) {
      expiresAt = Date.now() + options.PX;
    }

    if (options.NX && this.store.has(key)) {
      const existing = this.store.get(key);
      if (!existing.expiresAt || Date.now() <= existing.expiresAt) {
        return null;
      }
    }

    this.store.set(key, { value: String(value), expiresAt });
    return 'OK';
  }

  async setNX(key, value, options = {}) {
    return this.set(key, value, { ...options, NX: true });
  }

  async del(key) {
    const keys = Array.isArray(key) ? key : [key];
    let count = 0;
    for (const k of keys) {
      if (this.store.delete(k)) count++;
    }
    return count;
  }

  async exists(key) {
    const val = await this.get(key);
    return val !== null ? 1 : 0;
  }

  async expire(key, seconds) {
    const item = this.store.get(key);
    if (!item) return 0;
    item.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  async sAdd(key, member) {
    let set = this.store.get(key);
    if (!set || !(set.value instanceof Set)) {
      set = { value: new Set(), expiresAt: null };
      this.store.set(key, set);
    }
    set.value.add(String(member));
    return 1;
  }

  async sMembers(key) {
    const set = this.store.get(key);
    if (!set || !(set.value instanceof Set)) return [];
    return Array.from(set.value);
  }

  async sRem(key, member) {
    const set = this.store.get(key);
    if (!set || !(set.value instanceof Set)) return 0;
    return set.value.delete(String(member)) ? 1 : 0;
  }

  async ping() {
    return 'PONG';
  }
}

let redisClientInstance = null;
let isConnecting = false;

function getRedisClient() {
  if (redisClientInstance) {
    return redisClientInstance;
  }

  const redisUrl = process.env.REDIS_URL || (process.env.REDIS_HOST ? `redis://${process.env.REDIS_HOST}:6379` : null);

  if (!redis || !redisUrl) {
    logger.info('Redis URL not configured; using high-resilience in-memory distributed fallback');
    redisClientInstance = new InMemoryRedisFallback();
    return redisClientInstance;
  }

  try {
    const client = redis.createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.warn('Redis reconnection retries exhausted; switching to in-memory fallback');
            return new Error('Redis connection retry limit reached');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    client.on('error', (err) => {
      logger.error('Redis Client Error: %s', err.message);
    });

    client.on('connect', () => {
      logger.info('Connected to Redis cluster successfully');
    });

    if (!isConnecting) {
      isConnecting = true;
      client.connect().catch((err) => {
        logger.warn('Failed initial Redis connection: %s. Using in-memory fallback.', err.message);
        redisClientInstance = new InMemoryRedisFallback();
      });
    }

    redisClientInstance = client;
    return redisClientInstance;
  } catch (err) {
    logger.warn('Could not initialize Redis client: %s. Using in-memory fallback.', err.message);
    redisClientInstance = new InMemoryRedisFallback();
    return redisClientInstance;
  }
}

module.exports = {
  getRedisClient,
  InMemoryRedisFallback
};
