import { describe, it, expect } from "vitest";
import { createInMemoryRedisClient } from "../../src/infra/redis/client.js";
import { RateLimitService } from "../../src/modules/auth/service/rate-limit-service.js";

describe("RateLimitService", () => {
  it("project rate limit rejects excessive traffic", async () => {
    const redis = createInMemoryRedisClient();
    const svc = new RateLimitService(redis, {
      maxRequests: 3,
      windowSeconds: 60,
    });

    const r1 = await svc.check("proj_001");
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = await svc.check("proj_001");
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = await svc.check("proj_001");
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);

    // 4th request exceeds limit
    const r4 = await svc.check("proj_001");
    expect(r4.allowed).toBe(false);
    expect(r4.current).toBe(4);
    expect(r4.remaining).toBe(0);
  });

  it("separate projects have independent limits", async () => {
    const redis = createInMemoryRedisClient();
    const svc = new RateLimitService(redis, {
      maxRequests: 1,
      windowSeconds: 60,
    });

    const a1 = await svc.check("proj_a");
    expect(a1.allowed).toBe(true);

    const a2 = await svc.check("proj_a");
    expect(a2.allowed).toBe(false);

    // proj_b is independent
    const b1 = await svc.check("proj_b");
    expect(b1.allowed).toBe(true);
  });

  it("returns limit and reset metadata", async () => {
    const redis = createInMemoryRedisClient();
    const svc = new RateLimitService(redis, {
      maxRequests: 100,
      windowSeconds: 60,
    });

    const result = await svc.check("proj_001");
    expect(result.limit).toBe(100);
    expect(result.resetSeconds).toBe(60);
  });
});
