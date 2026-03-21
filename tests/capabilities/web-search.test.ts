import { describe, test, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { mockBraveFetch } from "../helpers/mock-brave.js";
import { buildTestApp } from "../helpers/build-test-app.js";

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
