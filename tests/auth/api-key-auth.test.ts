import { describe, test, expect, beforeEach } from "vitest";
import { buildApp } from "../../src/app/build-app.js";
import type { FastifyInstance } from "fastify";

describe("API key authentication", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
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

/** Return the well-known test API key used by the in-memory auth store. */
function getTestApiKey(): string {
  return "sk_test_seekapi_demo_key_001";
}
