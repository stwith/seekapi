import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { registerHealthRoutes } from "../../src/modules/health/http/routes.js";
import { ProviderRegistry } from "../../src/providers/core/registry.js";
import { BraveAdapter } from "../../src/providers/brave/adapter.js";

describe("Health routes", () => {
  let app: FastifyInstance;
  let registry: ProviderRegistry;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    registry = new ProviderRegistry();
    registry.register(new BraveAdapter());
    await registerHealthRoutes(app, { registry });
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
    expect(body.providers[0].status).toBe("healthy");
    expect(body.providers[0].checked_at).toBeDefined();
  });

  it("provider health endpoint returns empty list without registry", async () => {
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
