import { describe, test, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../src/app/build-app.js";
import type { FastifyInstance } from "fastify";

describe("POST /v1/search/web", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  test("valid request returns 200 with canonical response shape", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/web",
      payload: { query: "typescript fastify" },
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
    });

    expect(res.statusCode).toBe(400);
  });

  test("empty query string returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/web",
      payload: { query: "" },
    });

    expect(res.statusCode).toBe(400);
  });

  test("invalid time_range returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/web",
      payload: { query: "test", time_range: "century" },
    });

    expect(res.statusCode).toBe(400);
  });

  test("response includes a request_id header", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/web",
      payload: { query: "hello" },
    });

    expect(res.headers["x-request-id"]).toBeDefined();
    expect(typeof res.headers["x-request-id"]).toBe("string");
  });

  test("response request_id matches body request_id", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/web",
      payload: { query: "hello" },
    });

    const body = res.json();
    expect(res.headers["x-request-id"]).toBe(body.request_id);
  });

  test("delegates to search service with search.web capability", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/web",
      payload: { query: "test query", max_results: 5 },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.capability).toBe("search.web");
  });
});
