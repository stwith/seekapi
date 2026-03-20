import { describe, test, expect, beforeEach } from "vitest";
import { buildApp } from "../../src/app/build-app.js";
import type { FastifyInstance } from "fastify";

const AUTH_HEADER = { authorization: "Bearer sk_test_seekapi_demo_key_001" };

describe("POST /v1/search/images", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  test("valid request returns 200 with canonical response shape", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/images",
      payload: { query: "cute cats" },
      headers: AUTH_HEADER,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("request_id");
    expect(body).toHaveProperty("capability", "search.images");
    expect(body).toHaveProperty("items");
    expect(Array.isArray(body.items)).toBe(true);
  });

  test("missing query returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/images",
      payload: {},
      headers: AUTH_HEADER,
    });

    expect(res.statusCode).toBe(400);
  });

  test("response includes a request_id header", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/images",
      payload: { query: "landscapes" },
      headers: AUTH_HEADER,
    });

    expect(res.headers["x-request-id"]).toBeDefined();
  });

  test("delegates to search service with search.images capability", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/search/images",
      payload: { query: "nature photos" },
      headers: AUTH_HEADER,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.capability).toBe("search.images");
  });
});
