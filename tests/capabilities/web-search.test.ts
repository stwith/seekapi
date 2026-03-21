import { describe, test, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { mockBraveFetch } from "../helpers/mock-brave.js";
import { buildTestApp } from "../helpers/build-test-app.js";

function mockBraveFetchStatus(status: number): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("api.search.brave.com")) {
      return Promise.resolve(
        new Response(JSON.stringify({ error: "mock_error" }), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    return original(input);
  };
  return () => { globalThis.fetch = original; };
}

const AUTH_HEADER = { authorization: "Bearer sk_test_seekapi_demo_key_001" };

describe("POST /v1/search/web", () => {
  let app: FastifyInstance;
  let restoreFetch: () => void;

  beforeEach(async () => {
    restoreFetch = mockBraveFetch();
    app = await buildTestApp();
    await app.ready();
  });

  afterEach(() => {
    restoreFetch();
  });

  test("valid request returns 200 with canonical response shape", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/web",
      payload: { query: "typescript fastify" },
      headers: AUTH_HEADER,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("request_id");
    expect(body).toHaveProperty("capability", "search.web");
    expect(body).toHaveProperty("items");
    expect(Array.isArray(body.items)).toBe(true);
  });

  test("missing query returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/web",
      payload: {},
      headers: AUTH_HEADER,
    });

    expect(res.statusCode).toBe(400);
  });

  test("empty query string returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/web",
      payload: { query: "" },
      headers: AUTH_HEADER,
    });

    expect(res.statusCode).toBe(400);
  });

  test("invalid time_range returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/web",
      payload: { query: "test", time_range: "century" },
      headers: AUTH_HEADER,
    });

    expect(res.statusCode).toBe(400);
  });

  test("response includes a request_id header", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/web",
      payload: { query: "hello" },
      headers: AUTH_HEADER,
    });

    expect(res.headers["x-request-id"]).toBeDefined();
    expect(typeof res.headers["x-request-id"]).toBe("string");
  });

  test("response request_id matches body request_id", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/web",
      payload: { query: "hello" },
      headers: AUTH_HEADER,
    });

    const body = res.json();
    expect(res.headers["x-request-id"]).toBe(body.request_id);
  });

  test("unknown top-level fields are rejected with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/web",
      payload: { query: "test", brave_mode: "deep" },
      headers: AUTH_HEADER,
    });

    expect(res.statusCode).toBe(400);
  });

  test("delegates to search service with search.web capability", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/web",
      payload: { query: "test query", max_results: 5 },
      headers: AUTH_HEADER,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.capability).toBe("search.web");
  });
});

describe("POST /v1/search/web — gateway error mapping", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  test("upstream rate limit (429) maps to downstream 429 with PROVIDER_RATE_LIMITED", async () => {
    const restore = mockBraveFetchStatus(429);
    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/search/web",
        payload: { query: "test" },
        headers: AUTH_HEADER,
      });

      expect(res.statusCode).toBe(429);
      const body = res.json();
      expect(body.error).toBe("PROVIDER_RATE_LIMITED");
      expect(body).toHaveProperty("request_id");
      expect(body).toHaveProperty("message");
    } finally { restore(); }
  });

  test("upstream 500 maps to downstream 502 with PROVIDER_UPSTREAM_5XX", async () => {
    const restore = mockBraveFetchStatus(500);
    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/search/web",
        payload: { query: "test" },
        headers: AUTH_HEADER,
      });

      expect(res.statusCode).toBe(502);
      const body = res.json();
      expect(body.error).toBe("PROVIDER_UPSTREAM_5XX");
      expect(body).toHaveProperty("request_id");
    } finally { restore(); }
  });

  test("upstream bad credential (401) maps to downstream 502 with PROVIDER_BAD_CREDENTIAL", async () => {
    const restore = mockBraveFetchStatus(401);
    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/search/web",
        payload: { query: "test" },
        headers: AUTH_HEADER,
      });

      expect(res.statusCode).toBe(502);
      const body = res.json();
      expect(body.error).toBe("PROVIDER_BAD_CREDENTIAL");
      expect(body).toHaveProperty("request_id");
    } finally { restore(); }
  });

  test("network timeout maps to downstream 504 with PROVIDER_TIMEOUT", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("api.search.brave.com")) {
        return Promise.reject(new TypeError("fetch failed"));
      }
      return original(input);
    };
    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/search/web",
        payload: { query: "test" },
        headers: AUTH_HEADER,
      });

      expect(res.statusCode).toBe(504);
      const body = res.json();
      expect(body.error).toBe("PROVIDER_TIMEOUT");
      expect(body).toHaveProperty("request_id");
    } finally { globalThis.fetch = original; }
  });
});
