import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { buildApp } from "../../src/app/build-app.js";
import type { FastifyInstance } from "fastify";
import { mockBraveFetch } from "../helpers/mock-brave.js";
import { registerAuthPreHandler } from "../../src/modules/auth/http/pre-handler.js";
import Fastify from "fastify";

describe("API key authentication", () => {
  let app: FastifyInstance;
  let restoreFetch: () => void;

  beforeEach(async () => {
    restoreFetch = mockBraveFetch();
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterEach(() => {
    restoreFetch();
  });

  test("missing Authorization header returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/web",
      payload: { query: "hello" },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error).toBe("UNAUTHORIZED");
  });

  test("malformed Authorization header returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/web",
      payload: { query: "hello" },
      headers: { authorization: "Basic abc123" },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error).toBe("UNAUTHORIZED");
  });

  test("invalid API key returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/web",
      payload: { query: "hello" },
      headers: { authorization: "Bearer sk_invalid_key_000" },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error).toBe("UNAUTHORIZED");
  });

  test("valid API key returns 200 with project context", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/web",
      payload: { query: "hello" },
      headers: { authorization: `Bearer ${getTestApiKey()}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("request_id");
    expect(body).toHaveProperty("capability", "search.web");
  });

  test("health endpoint does not require auth", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/health",
    });

    expect(res.statusCode).toBe(200);
  });

  test("health endpoint with query string bypasses auth", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/health?x=1",
    });

    expect(res.statusCode).toBe(200);
  });

  test("lowercase bearer scheme is accepted (RFC 7235)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/web",
      payload: { query: "hello" },
      headers: { authorization: `bearer ${getTestApiKey()}` },
    });

    expect(res.statusCode).toBe(200);
  });

  test("mixed-case bearer scheme is accepted", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/web",
      payload: { query: "hello" },
      headers: { authorization: `BEARER ${getTestApiKey()}` },
    });

    expect(res.statusCode).toBe(200);
  });

  test("valid API key attaches project context to request", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/web",
      payload: { query: "context test" },
      headers: { authorization: `Bearer ${getTestApiKey()}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("provider");
  });
});

describe("Rate-limit backend failure", () => {
  test("request succeeds when rateLimitService.check() throws", async () => {
    const app = Fastify({ logger: false });

    const failingRateLimitService = {
      check: () => Promise.reject(new Error("Redis connection refused")),
    };

    await registerAuthPreHandler(app, {
      rateLimitService: failingRateLimitService as never,
    });

    app.post("/v1/search/web", async () => ({ ok: true }));
    await app.ready();

    const res = await app.inject({
      method: "POST",
      url: "/v1/search/web",
      payload: { query: "test" },
      headers: { authorization: `Bearer ${getTestApiKey()}` },
    });

    // Should NOT be 500 — request degrades gracefully
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});

/** Return the well-known test API key used by the in-memory auth store. */
function getTestApiKey(): string {
  return "sk_test_seekapi_demo_key_001";
}
