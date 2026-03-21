/**
 * Redis client factory — creates an ioredis instance for ephemeral state.
 *
 * Used for rate-limit counters and provider health snapshots.
 * Falls back to a stub client when REDIS_URL is not configured,
 * keeping the app bootable in dev/test without Redis.
 */

import RedisLib from "ioredis";
// ioredis CJS default export needs this pattern for ESM/TS compat
const Redis = RedisLib.default ?? RedisLib;

export interface RedisClient {
  /** Increment a key and set TTL if it's a new key. Returns the new count. */
  incr(key: string): Promise<number>;
  /** Set expiry on a key (seconds). */
  expire(key: string, seconds: number): Promise<number>;
  /** Get a key's value. */
  get(key: string): Promise<string | null>;
  /** Set a key with optional expiry in seconds. */
  set(key: string, value: string, expirySeconds?: number): Promise<void>;
  /** Check remaining TTL of a key (-1 if no expiry, -2 if key missing). */
  ttl(key: string): Promise<number>;
  /** Disconnect. */
  quit(): Promise<void>;
}

/** Create a real ioredis-backed client. */
export function createRedisClient(url?: string): RedisClient {
  const redis = url ? new Redis(url) : new Redis();

  return {
    incr: (key) => redis.incr(key),
    expire: (key, seconds) => redis.expire(key, seconds),
    get: (key) => redis.get(key),
    async set(key, value, expirySeconds) {
      if (expirySeconds) {
        await redis.set(key, value, "EX", expirySeconds);
      } else {
        await redis.set(key, value);
      }
    },
    ttl: (key) => redis.ttl(key),
    quit: async () => {
      await redis.quit();
    },
  };
}

/** In-memory stub for tests — no real Redis needed. */
export function createInMemoryRedisClient(): RedisClient {
  const store = new Map<string, { value: string; expiresAt?: number }>();

  function isAlive(key: string): boolean {
    const entry = store.get(key);
    if (!entry) return false;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      store.delete(key);
      return false;
    }
    return true;
  }

  return {
    async incr(key) {
      const current = isAlive(key) ? parseInt(store.get(key)!.value, 10) : 0;
      const next = current + 1;
      const existing = store.get(key);
      store.set(key, {
        value: String(next),
        expiresAt: existing?.expiresAt,
      });
      return next;
    },
    async expire(key, seconds) {
      const entry = store.get(key);
      if (!entry) return 0;
      entry.expiresAt = Date.now() + seconds * 1000;
      return 1;
    },
    async get(key) {
      return isAlive(key) ? store.get(key)!.value : null;
    },
    async set(key, value, expirySeconds) {
      store.set(key, {
        value,
        expiresAt: expirySeconds
          ? Date.now() + expirySeconds * 1000
          : undefined,
      });
    },
    async ttl(key) {
      const entry = store.get(key);
      if (!entry) return -2;
      if (!entry.expiresAt) return -1;
      const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
      return remaining > 0 ? remaining : -2;
    },
    async quit() {
      store.clear();
    },
  };
}
