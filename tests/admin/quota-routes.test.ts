/**
 * Admin quota route tests. [Task 38]
 *
 * Covers:
 * - GET /v1/admin/projects/:projectId/quota — get quota + current usage
 * - PUT /v1/admin/projects/:projectId/quota — create/update quota
 * - GET /v1/admin/quotas — list all quotas with usage
 * - Admin auth enforcement
 * - 404 for unknown projects
 * - Validation of quota fields
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app/build-app.js";
import { seedTestRepositories, TEST_PROJECT_ID } from "../helpers/seed-test-repos.js";

const ADMIN_KEY = "admin_test_key_001";

describe("Admin quota routes [Task 38]", () => {
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

  // --- Auth ---

  it("rejects quota request without admin key", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/admin/projects/${TEST_PROJECT_ID}/quota`,
    });
    expect(res.statusCode).toBe(401);
  });

  // --- GET quota ---

  it("returns default quota for project with no quota set", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/admin/projects/${TEST_PROJECT_ID}/quota`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.projectId).toBe(TEST_PROJECT_ID);
    // Default values when no quota is configured
    expect(body.dailyRequestLimit).toBeNull();
    expect(body.monthlyRequestLimit).toBeNull();
    expect(body.maxKeys).toBe(10);
    expect(body.rateLimitRpm).toBe(60);
    expect(body.status).toBe("active");
    // Should include current usage
    expect(typeof body.currentDailyUsage).toBe("number");
    expect(typeof body.currentMonthlyUsage).toBe("number");
  });

  it("returns 404 for unknown project quota", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/admin/projects/00000000-0000-0000-0000-000000000000/quota",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(404);
  });

  // --- PUT quota ---

  it("creates quota for a project", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/v1/admin/projects/${TEST_PROJECT_ID}/quota`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: {
        dailyRequestLimit: 1000,
        monthlyRequestLimit: 10000,
        maxKeys: 5,
        rateLimitRpm: 120,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.dailyRequestLimit).toBe(1000);
    expect(body.monthlyRequestLimit).toBe(10000);
    expect(body.maxKeys).toBe(5);
    expect(body.rateLimitRpm).toBe(120);
  });

  it("reads back updated quota", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/admin/projects/${TEST_PROJECT_ID}/quota`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.dailyRequestLimit).toBe(1000);
    expect(body.monthlyRequestLimit).toBe(10000);
    expect(body.maxKeys).toBe(5);
    expect(body.rateLimitRpm).toBe(120);
  });

  it("updates existing quota (partial update)", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/v1/admin/projects/${TEST_PROJECT_ID}/quota`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: {
        dailyRequestLimit: 2000,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.dailyRequestLimit).toBe(2000);
    // Other fields should remain
    expect(body.monthlyRequestLimit).toBe(10000);
  });

  it("can set limit to null (unlimited)", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/v1/admin/projects/${TEST_PROJECT_ID}/quota`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: {
        dailyRequestLimit: null,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.dailyRequestLimit).toBeNull();
  });

  it("returns 404 when updating quota for unknown project", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/v1/admin/projects/00000000-0000-0000-0000-000000000000/quota",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { dailyRequestLimit: 100 },
    });
    expect(res.statusCode).toBe(404);
  });

  // --- GET all quotas ---

  it("lists all quotas", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/admin/quotas",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.quotas)).toBe(true);
    // At least the one we created
    const found = body.quotas.find((q: { projectId: string }) => q.projectId === TEST_PROJECT_ID);
    expect(found).toBeDefined();
    expect(typeof found.currentDailyUsage).toBe("number");
    expect(typeof found.currentMonthlyUsage).toBe("number");
  });
});
