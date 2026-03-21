import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { registerHealthRoutes } from "../../src/modules/health/http/routes.js";
import { HealthService } from "../../src/modules/health/service/health-service.js";
import { ProviderRegistry } from "../../src/providers/core/registry.js";
import { BraveAdapter } from "../../src/providers/brave/adapter.js";

describe("Health routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    const registry = new ProviderRegistry();
    registry.register(new BraveAdapter());
    const healthService = new HealthService({
      registry,
      resolveHealthCredential: async () => undefined,
    });
    await registerHealthRoutes(app, { healthService });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("health endpoint reports gateway readiness", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/health",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
  });

  it("provider health endpoint reports Brave status", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/health/providers",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.providers).toHaveLength(1);
    expect(body.providers[0].provider).toBe("brave");
    // Without a credential, Brave reports unavailable (no placeholder "healthy")
    expect(body.providers[0].status).toBe("unavailable");
    expect(body.providers[0].checked_at).toBeDefined();
  });

  it("provider health endpoint returns empty list without healthService", async () => {
    const bareApp = Fastify({ logger: false });
    await registerHealthRoutes(bareApp);
    await bareApp.ready();

    const res = await bareApp.inject({
      method: "GET",
      url: "/v1/health/providers",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().providers).toEqual([]);

    await bareApp.close();
  });
});

describe("HealthService caching", () => {
  it("caches provider health results within TTL", async () => {
    let probeCount = 0;
    const registry = new ProviderRegistry();
    registry.register(new BraveAdapter());
    const service = new HealthService({
      registry,
      resolveHealthCredential: async () => {
        probeCount++;
        return undefined;
      },
      cacheTtlMs: 60_000,
    });

    await service.getProviderHealth();
    await service.getProviderHealth();
    await service.getProviderHealth();

    // Only one probe despite three calls
    expect(probeCount).toBe(1);
  });

  it("re-probes after cache expires", async () => {
    let probeCount = 0;
    const registry = new ProviderRegistry();
    registry.register(new BraveAdapter());
    const service = new HealthService({
      registry,
      resolveHealthCredential: async () => {
        probeCount++;
        return undefined;
      },
      cacheTtlMs: 1, // 1ms TTL — expires immediately
    });

    await service.getProviderHealth();
    // Wait for cache to expire
    await new Promise((r) => setTimeout(r, 10));
    await service.getProviderHealth();

    expect(probeCount).toBe(2);
  });
});
