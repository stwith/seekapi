import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { buildApp } from "../../src/app/build-app.js";
import type { FastifyInstance } from "fastify";
import { mockBraveFetch } from "../helpers/mock-brave.js";

const AUTH_HEADER = { authorization: "Bearer sk_test_seekapi_demo_key_001" };

describe("POST /v1/search/news", () => {
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

  test("valid request returns 200 with canonical response shape", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/news",
      payload: { query: "latest tech news" },
      headers: AUTH_HEADER,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("request_id");
    expect(body).toHaveProperty("capability", "search.news");
    expect(body).toHaveProperty("items");
    expect(Array.isArray(body.items)).toBe(true);
  });

  test("missing query returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/news",
      payload: {},
      headers: AUTH_HEADER,
    });

    expect(res.statusCode).toBe(400);
  });

  test("response includes a request_id header", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/news",
      payload: { query: "hello" },
      headers: AUTH_HEADER,
    });

    expect(res.headers["x-request-id"]).toBeDefined();
  });

  test("delegates to search service with search.news capability", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/news",
      payload: { query: "breaking news" },
      headers: AUTH_HEADER,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.capability).toBe("search.news");
  });
});
