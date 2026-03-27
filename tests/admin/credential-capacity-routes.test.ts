import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app/build-app.js";
import { seedTestRepositories, TEST_GLOBAL_CREDENTIAL_ID } from "../helpers/seed-test-repos.js";

const ADMIN_KEY = "admin_test_key_001";

describe("AC7 — Admin credential capacity/usage endpoints", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const repos = seedTestRepositories();
    app = await buildApp({
      logger: false,
      ...repos,
      adminApiKey: ADMIN_KEY,
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("PUT /v1/admin/credentials/:id/capacity sets capacity", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/v1/admin/credentials/${TEST_GLOBAL_CREDENTIAL_ID}/capacity`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { dailyLimit: 1000, monthlyLimit: 25000 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.credentialId).toBe(TEST_GLOBAL_CREDENTIAL_ID);
    expect(body.dailyLimit).toBe(1000);
    expect(body.monthlyLimit).toBe(25000);
  });

  it("GET /v1/admin/credentials/:id/capacity returns capacity + usage", async () => {
    // First set capacity
    await app.inject({
      method: "PUT",
      url: `/v1/admin/credentials/${TEST_GLOBAL_CREDENTIAL_ID}/capacity`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { dailyLimit: 500, monthlyLimit: 10000 },
    });

    const res = await app.inject({
      method: "GET",
      url: `/v1/admin/credentials/${TEST_GLOBAL_CREDENTIAL_ID}/capacity`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.credentialId).toBe(TEST_GLOBAL_CREDENTIAL_ID);
    expect(body.dailyLimit).toBe(500);
    expect(body.monthlyLimit).toBe(10000);
    expect(body.currentDailyUsage).toBeDefined();
    expect(body.currentMonthlyUsage).toBeDefined();
  });

  it("GET /v1/admin/credentials/:id/capacity returns 404 for no capacity", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/admin/credentials/cred_no_capacity/capacity",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("GET /v1/admin/credentials/:id/usage returns usage stats", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/admin/credentials/${TEST_GLOBAL_CREDENTIAL_ID}/usage`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.credentialId).toBe(TEST_GLOBAL_CREDENTIAL_ID);
    expect(body.totalRequests).toBeDefined();
    expect(typeof body.totalRequests).toBe("number");
  });

  it("rejects capacity endpoints without admin key", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/admin/credentials/${TEST_GLOBAL_CREDENTIAL_ID}/capacity`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("PUT capacity rejects negative dailyLimit", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/v1/admin/credentials/${TEST_GLOBAL_CREDENTIAL_ID}/capacity`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { dailyLimit: -5, monthlyLimit: 100 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("PUT capacity rejects negative monthlyLimit", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/v1/admin/credentials/${TEST_GLOBAL_CREDENTIAL_ID}/capacity`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { dailyLimit: 100, monthlyLimit: -1 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("PUT capacity returns 404 for non-existent credential", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/v1/admin/credentials/cred_nonexistent_xyz/capacity",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { dailyLimit: 100 },
    });
    expect(res.statusCode).toBe(404);
  });
});
