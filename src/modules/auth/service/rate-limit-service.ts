/**
 * Rate-limit service — fixed-window per-project rate limiting backed by Redis.
 *
 * Each project gets a counter key `ratelimit:{projectId}:{windowKey}`.
 * The window resets every `windowSeconds`. When the counter exceeds
 * `maxRequests`, the request is rejected.
 */

import type { RedisClient } from "../../../infra/redis/client.js";
import { rateLimitCounter } from "../../../infra/telemetry/index.js";

export interface RateLimitConfig {
  /** Max requests per window. */
  maxRequests: number;
  /** Window duration in seconds. */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 100,
  windowSeconds: 60,
};

export class RateLimitService {
  private readonly redis: RedisClient;
  private readonly config: RateLimitConfig;

  constructor(redis: RedisClient, config?: Partial<RateLimitConfig>) {
    this.redis = redis;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async check(projectId: string): Promise<RateLimitResult> {
    const nowSeconds = Date.now() / 1000;
    const windowKey = Math.floor(nowSeconds / this.config.windowSeconds);
    const key = `ratelimit:${projectId}:${windowKey}`;

    const count = await this.redis.incr(key);

    // Set TTL on first increment so the key auto-expires
    if (count === 1) {
      await this.redis.expire(key, this.config.windowSeconds);
    }

    const allowed = count <= this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - count);

    // Compute remaining seconds until the current window resets
    const windowEnd = (windowKey + 1) * this.config.windowSeconds;
    const resetSeconds = Math.max(1, Math.ceil(windowEnd - nowSeconds));

    if (!allowed) {
      rateLimitCounter.add(1, { project_id: projectId });
    }

    return {
      allowed,
      current: count,
      limit: this.config.maxRequests,
      remaining,
      resetSeconds,
    };
  }
}
