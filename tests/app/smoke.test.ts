import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app/build-app.js";
import { mockBraveFetch } from "../helpers/mock-brave.js";

/**
 * Task 10 — smoke tests for full application composition.
 * Verifies the gateway boots, exposes all expected routes,
 * and enforces auth on protected endpoints.
 */
describe("Application smoke tests", () => {
  let app: FastifyInstance;
  let restoreFetch: () => void;

  beforeAll(async () => {
    restoreFetch = mockBraveFetch();
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    restoreFetch();
  });

  // --- Boot ---

  it("app boots successfully", () => {
    expect(app).toBeDefined();
  });

  // --- Route table ---

  it("registers GET /v1/health", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok" });
  });

  it("registers GET /v1/health/providers", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/health/providers",
      headers: { authorization: "Bearer sk_test_seekapi_demo_key_001" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("providers");
  });

  it("registers POST /v1/search/web", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/web",
      payload: { query: "smoke test" },
      headers: { authorization: "Bearer sk_test_seekapi_demo_key_001" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("capability", "search.web");
  });

  it("registers POST /v1/search/news", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/news",
      payload: { query: "smoke test" },
      headers: { authorization: "Bearer sk_test_seekapi_demo_key_001" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("capability", "search.news");
  });

  it("registers POST /v1/search/images", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/images",
      payload: { query: "smoke test" },
      headers: { authorization: "Bearer sk_test_seekapi_demo_key_001" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("capability", "search.images");
  });

  // --- Auth enforcement ---

  it("rejects unauthenticated request to search endpoint", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/web",
      payload: { query: "no auth" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: "UNAUTHORIZED" });
  });

  it("rejects unauthenticated request to provider health", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/health/providers",
    });
    expect(res.statusCode).toBe(401);
  });

  it("allows unauthenticated access to gateway health", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/health",
    });
    expect(res.statusCode).toBe(200);
  });

  // --- Response shape ---

  it("search response includes request_id and provider", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/web",
      payload: { query: "shape test" },
      headers: { authorization: "Bearer sk_test_seekapi_demo_key_001" },
    });
    const body = res.json();
    expect(body.request_id).toBeDefined();
    expect(body.provider).toBe("brave");
    expect(body.items).toBeInstanceOf(Array);
    expect(body.items.length).toBeGreaterThan(0);
  });
});
