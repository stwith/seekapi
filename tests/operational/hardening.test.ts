/**
 * Operational hardening tests for Task 15 / AC4.
 *
 * Covers:
 * - Rate limit graceful degradation when Redis is unavailable
 * - HealthService.isHealthy() reflects degraded providers
 * - Health probe timeout bounding
 * - Error classifier deterministic classification
 */

import { describe, it, expect } from "vitest";
import { RateLimitService } from "../../src/modules/auth/service/rate-limit-service.js";
import { HealthService } from "../../src/modules/health/service/health-service.js";
import { classifyError } from "../../src/modules/routing/service/error-classifier.js";
import { ProviderError } from "../../src/providers/core/errors.js";
import type { RedisClient } from "../../src/infra/redis/client.js";
import type { ProviderRegistry } from "../../src/providers/core/registry.js";

/* ------------------------------------------------------------------ */
/*  Rate limit: Redis unavailable                                     */
/* ------------------------------------------------------------------ */

describe("RateLimitService graceful degradation [AC4]", () => {
  function brokenRedis(): RedisClient {
    return {
      incr: () => Promise.reject(new Error("ECONNREFUSED")),
      expire: () => Promise.reject(new Error("ECONNREFUSED")),
      get: () => Promise.reject(new Error("ECONNREFUSED")),
      set: () => Promise.reject(new Error("ECONNREFUSED")),
      ttl: () => Promise.reject(new Error("ECONNREFUSED")),
      quit: () => Promise.resolve(),
    };
  }

  it("allows requests when Redis is unavailable", async () => {
    const svc = new RateLimitService(brokenRedis(), {
      maxRequests: 10,
      windowSeconds: 60,
    });

    const result = await svc.check("proj_001");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(10);
    expect(result.current).toBe(0);
  });

  it("returns valid metadata when Redis is unavailable", async () => {
    const svc = new RateLimitService(brokenRedis(), {
      maxRequests: 100,
      windowSeconds: 60,
    });

    const result = await svc.check("proj_001");
    expect(result.limit).toBe(100);
    expect(result.resetSeconds).toBeGreaterThanOrEqual(1);
    expect(result.resetSeconds).toBeLessThanOrEqual(60);
  });
});

/* ------------------------------------------------------------------ */
/*  HealthService: isHealthy reflects degraded status                 */
/* ------------------------------------------------------------------ */

describe("HealthService.isHealthy [AC4]", () => {
  function makeHealthService(
    probeResults: Array<{ id: string; status: "healthy" | "degraded" | "unavailable" }>,
  ) {
    const registry: ProviderRegistry = {
      list: () =>
        probeResults.map((p) => ({
          id: p.id,
          capabilities: ["search.web"],
          healthCheck: async () => ({
            status: p.status,
            latencyMs: 10,
            checkedAt: new Date(),
          }),
          search: async () => ({ results: [], totalResults: 0 }),
        })),
      get: () => undefined,
      register: () => {},
    };

    return new HealthService({
      registry,
      resolveHealthCredential: async () => "test-key",
      cacheTtlMs: 60_000,
    });
  }

  it("returns true before any probe", () => {
    const svc = makeHealthService([{ id: "brave", status: "healthy" }]);
    expect(svc.isHealthy("brave")).toBe(true);
  });

  it("returns true for healthy provider after probe", async () => {
    const svc = makeHealthService([{ id: "brave", status: "healthy" }]);
    await svc.getProviderHealth();
    expect(svc.isHealthy("brave")).toBe(true);
  });

  it("returns false for degraded provider after probe", async () => {
    const svc = makeHealthService([{ id: "brave", status: "degraded" }]);
    await svc.getProviderHealth();
    expect(svc.isHealthy("brave")).toBe(false);
  });

  it("returns true for unavailable provider (optimistic)", async () => {
    const svc = makeHealthService([{ id: "brave", status: "unavailable" }]);
    await svc.getProviderHealth();
    expect(svc.isHealthy("brave")).toBe(true);
  });

  it("returns true for unknown provider", async () => {
    const svc = makeHealthService([{ id: "brave", status: "healthy" }]);
    await svc.getProviderHealth();
    expect(svc.isHealthy("google")).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Health probe: bounded timeout                                     */
/* ------------------------------------------------------------------ */

describe("HealthService probe timeout [AC4]", () => {
  it("marks slow provider as unavailable rather than hanging", async () => {
    const registry: ProviderRegistry = {
      list: () => [
        {
          id: "slow",
          capabilities: ["search.web"],
          healthCheck: () => new Promise(() => {}), // never resolves
          search: async () => ({ results: [], totalResults: 0 }),
        },
      ],
      get: () => undefined,
      register: () => {},
    };

    const svc = new HealthService({
      registry,
      resolveHealthCredential: async () => "key",
      cacheTtlMs: 0,
    });

    const start = Date.now();
    const results = await svc.getProviderHealth();
    const elapsed = Date.now() - start;

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("unavailable");
    expect(elapsed).toBeLessThan(15_000); // bounded by 10s probe timeout
  }, 20_000);
});

/* ------------------------------------------------------------------ */
/*  Error classifier: deterministic classification                    */
/* ------------------------------------------------------------------ */

describe("classifyError deterministic classification [AC4]", () => {
  it("classifies ProviderError with upstream_5xx as retryable", () => {
    const err = new ProviderError({
      message: "502 Bad Gateway",
      category: "upstream_5xx",
      provider: "brave",
      statusCode: 502,
    });
    const result = classifyError(err);
    expect(result.category).toBe("retryable");
    expect(result.retryable).toBe(true);
  });

  it("classifies ProviderError with bad_credential as non-retryable auth", () => {
    const err = new ProviderError({
      message: "401 Unauthorized",
      category: "bad_credential",
      provider: "brave",
      statusCode: 401,
    });
    const result = classifyError(err);
    expect(result.category).toBe("auth");
    expect(result.retryable).toBe(false);
  });

  it("classifies ProviderError with rate_limited as retryable", () => {
    const err = new ProviderError({
      message: "429 Too Many Requests",
      category: "rate_limited",
      provider: "brave",
      statusCode: 429,
    });
    const result = classifyError(err);
    expect(result.category).toBe("retryable");
    expect(result.retryable).toBe(true);
  });

  it("classifies ProviderError with timeout as retryable", () => {
    const err = new ProviderError({
      message: "Request timed out",
      category: "timeout",
      provider: "brave",
    });
    const result = classifyError(err);
    expect(result.category).toBe("retryable");
    expect(result.retryable).toBe(true);
  });

  it("classifies heuristic 5xx as retryable", () => {
    const err = { statusCode: 503, message: "Service Unavailable" };
    const result = classifyError(err);
    expect(result.category).toBe("retryable");
    expect(result.retryable).toBe(true);
  });

  it("classifies heuristic 401 as auth non-retryable", () => {
    const err = { statusCode: 401, message: "Unauthorized" };
    const result = classifyError(err);
    expect(result.category).toBe("auth");
    expect(result.retryable).toBe(false);
  });

  it("classifies heuristic 400 as invalid_request non-retryable", () => {
    const err = { statusCode: 400, message: "Bad Request" };
    const result = classifyError(err);
    expect(result.category).toBe("invalid_request");
    expect(result.retryable).toBe(false);
  });

  it("classifies TIMEOUT code as retryable", () => {
    const err = { code: "TIMEOUT" };
    const result = classifyError(err);
    expect(result.category).toBe("retryable");
    expect(result.retryable).toBe(true);
  });

  it("classifies ECONNREFUSED as retryable", () => {
    const err = { code: "ECONNREFUSED" };
    const result = classifyError(err);
    expect(result.category).toBe("retryable");
    expect(result.retryable).toBe(true);
  });

  it("classifies PROJECT_RATE_LIMITED as non-retryable", () => {
    const err = { code: "PROJECT_RATE_LIMITED" };
    const result = classifyError(err);
    expect(result.category).toBe("rate_limit_project");
    expect(result.retryable).toBe(false);
  });

  it("classifies unknown error as non-retryable", () => {
    const err = new Error("Something unexpected");
    const result = classifyError(err);
    expect(result.category).toBe("unknown");
    expect(result.retryable).toBe(false);
  });
});
