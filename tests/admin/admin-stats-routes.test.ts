/**
 * Admin stats, usage query, and audit query route tests. [Phase 3.5 AC6][AC7]
 *
 * Covers:
 * - Dashboard aggregated stats endpoint
 * - Time series endpoint
 * - Capability breakdown endpoint
 * - Usage event query with filtering and pagination
 * - Per-key usage stats
 * - Audit log query with filtering and pagination
 *
 * All endpoints require admin auth (Bearer ADMIN_API_KEY).
 * Tests use in-memory repositories with pre-seeded usage and audit data.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app/build-app.js";
import { seedTestRepositories, TEST_PROJECT_ID, TEST_API_KEY_ID } from "../helpers/seed-test-repos.js";
import type { InMemoryUsageEventRepository } from "../../src/infra/db/repositories/usage-event-repository.js";
import type { InMemoryAuditLogRepository } from "../../src/infra/db/repositories/audit-log-repository.js";

const ADMIN_KEY = "admin_test_key_001";

describe("Admin stats & query routes [Phase 3.5 AC6]", () => {
  let app: FastifyInstance;
  let usageRepo: InMemoryUsageEventRepository;
  let auditRepo: InMemoryAuditLogRepository;

  beforeAll(async () => {
    const repos = seedTestRepositories();
    usageRepo = repos.usageEventRepository;
    auditRepo = repos.auditLogRepository;

    // Seed usage events for query tests

    await usageRepo.record({
      requestId: "req_1",
      projectId: TEST_PROJECT_ID,
      apiKeyId: TEST_API_KEY_ID,
      provider: "brave",
      capability: "search.web",
      statusCode: 200,
      success: true,
      latencyMs: 120,
      resultCount: 10,
      fallbackCount: 0,
    });
    await usageRepo.record({
      requestId: "req_2",
      projectId: TEST_PROJECT_ID,
      apiKeyId: TEST_API_KEY_ID,
      provider: "brave",
      capability: "search.news",
      statusCode: 200,
      success: true,
      latencyMs: 200,
      resultCount: 5,
      fallbackCount: 0,
    });
    await usageRepo.record({
      requestId: "req_3",
      projectId: TEST_PROJECT_ID,
      apiKeyId: "key_other_001",
      provider: "brave",
      capability: "search.web",
      statusCode: 502,
      success: false,
      latencyMs: 300,
      resultCount: 0,
      fallbackCount: 1,
    });

    // Seed audit log entries
    await auditRepo.record({
      projectId: TEST_PROJECT_ID,
      actorType: "api_key",
      actorId: TEST_API_KEY_ID,
      action: "search.execute",
      resourceType: "capability",
      resourceId: "search.web",
      details: { provider: "brave", query: "test" },
    });
    await auditRepo.record({
      projectId: TEST_PROJECT_ID,
      actorType: "admin",
      actorId: "admin",
      action: "credential.rotate",
      resourceType: "credential",
      resourceId: "cred_001",
    });

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

  // --- Auth guard on new endpoints ---

  it("rejects stats request without admin key", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/admin/stats/dashboard",
    });
    expect(res.statusCode).toBe(401);
  });

  // --- Dashboard stats ---

  it("returns aggregated dashboard stats", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/admin/stats/dashboard",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.totalRequests).toBe(3);
    expect(body.successCount).toBe(2);
    expect(body.failureCount).toBe(1);
    expect(body.avgLatencyMs).toBeCloseTo((120 + 200 + 300) / 3, 0);
  });

  it("returns dashboard stats filtered by projectId", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/admin/stats/dashboard?projectId=${TEST_PROJECT_ID}`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.totalRequests).toBe(3);
  });

  it("returns zero stats for unknown project", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/admin/stats/dashboard?projectId=00000000-0000-0000-0000-000000000000",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.totalRequests).toBe(0);
  });

  // --- Time series ---

  it("returns time series data", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/admin/stats/timeseries?granularity=hour",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.series)).toBe(true);
    // All 3 events are in the same bucket since they were recorded at roughly the same time
    const totalCount = body.series.reduce((sum: number, p: { count: number }) => sum + p.count, 0);
    expect(totalCount).toBe(3);
  });

  // --- Capability breakdown ---

  it("returns capability breakdown", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/admin/stats/capabilities",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.capabilities)).toBe(true);
    const webEntry = body.capabilities.find((c: { capability: string }) => c.capability === "search.web");
    expect(webEntry).toBeDefined();
    expect(webEntry.count).toBe(2);
    const newsEntry = body.capabilities.find((c: { capability: string }) => c.capability === "search.news");
    expect(newsEntry).toBeDefined();
    expect(newsEntry.count).toBe(1);
  });

  // --- Usage query ---

  it("returns paginated usage events", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/admin/usage?page=1&pageSize=10",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(3);
    expect(body.items).toHaveLength(3);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(10);
  });

  it("filters usage events by capability", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/admin/usage?capability=search.news",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(1);
    expect(body.items[0].capability).toBe("search.news");
  });

  it("filters usage events by success status", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/admin/usage?success=false",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(1);
    expect(body.items[0].success).toBe(false);
  });

  it("filters usage events by apiKeyId", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/admin/usage?apiKeyId=${TEST_API_KEY_ID}`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(2);
    body.items.forEach((item: { apiKeyId: string }) => {
      expect(item.apiKeyId).toBe(TEST_API_KEY_ID);
    });
  });

  it("paginates usage events correctly", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/admin/usage?page=1&pageSize=2",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(3);
    expect(body.items).toHaveLength(2);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(2);
  });

  it("clamps pageSize to max 200", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/admin/usage?pageSize=999",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.pageSize).toBeLessThanOrEqual(200);
  });

  // --- Per-key stats ---

  it("returns per-key usage stats for a project", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/admin/projects/${TEST_PROJECT_ID}/keys/stats`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.keys)).toBe(true);
    const demoKeyStats = body.keys.find((k: { apiKeyId: string }) => k.apiKeyId === TEST_API_KEY_ID);
    expect(demoKeyStats).toBeDefined();
    expect(demoKeyStats.requestCount).toBe(2);
  });

  it("returns 404 for per-key stats on unknown project", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/admin/projects/00000000-0000-0000-0000-000000000000/keys/stats",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(404);
  });

  // --- Audit log query ---

  it("returns paginated audit log entries", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/admin/audit?page=1&pageSize=10",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(2);
    expect(body.items).toHaveLength(2);
  });

  it("filters audit log by action", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/admin/audit?action=credential.rotate",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(1);
    expect(body.items[0].action).toBe("credential.rotate");
  });

  it("filters audit log by projectId", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/admin/audit?projectId=${TEST_PROJECT_ID}`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(2);
  });
});
