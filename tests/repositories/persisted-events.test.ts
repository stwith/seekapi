/**
 * Integration tests for durable event recording. [AC3]
 *
 * Verifies that usage events, audit logs, and health snapshots
 * are persisted as real records through repository-backed sinks.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { UsageService } from "../../src/modules/usage/service/usage-service.js";
import { AuditService } from "../../src/modules/audit/service/audit-service.js";
import { HealthService } from "../../src/modules/health/service/health-service.js";
import { InMemoryUsageEventRepository } from "../../src/infra/db/repositories/usage-event-repository.js";
import { InMemoryAuditLogRepository } from "../../src/infra/db/repositories/audit-log-repository.js";
import { InMemoryHealthSnapshotRepository } from "../../src/infra/db/repositories/health-snapshot-repository.js";
import type { ProviderRegistry } from "../../src/providers/core/registry.js";

/* ------------------------------------------------------------------ */
/*  Usage event persistence                                           */
/* ------------------------------------------------------------------ */

describe("UsageEventRepository persistence", () => {
  let repo: InMemoryUsageEventRepository;
  let svc: UsageService;

  beforeEach(() => {
    repo = new InMemoryUsageEventRepository();
    svc = new UsageService(repo);
  });

  it("successful Brave request persists a usage event", async () => {
    await svc.recordSuccess({
      requestId: "req_001",
      projectId: "proj_001",
      apiKeyId: "key_001",
      provider: "brave",
      capability: "search.web",
      latencyMs: 120,
      resultCount: 10,
      fallbackCount: 0,
    });

    const events = await repo.findAll();
    expect(events).toHaveLength(1);
    expect(events[0].provider).toBe("brave");
    expect(events[0].success).toBe(true);
    expect(events[0].statusCode).toBe(200);
    expect(events[0].resultCount).toBe(10);
  });

  it("failed request persists a usage event with error details", async () => {
    await svc.recordFailure({
      requestId: "req_002",
      projectId: "proj_001",
      apiKeyId: "key_001",
      provider: "brave",
      capability: "search.web",
      statusCode: 502,
      latencyMs: 300,
      fallbackCount: 1,
      errorCode: "UPSTREAM_ERROR",
    });

    const events = await repo.findAll();
    expect(events).toHaveLength(1);
    expect(events[0].success).toBe(false);
    expect(events[0].statusCode).toBe(502);
    expect(events[0].fallbackCount).toBe(1);
  });

  it("multiple requests accumulate in the repository", async () => {
    await svc.recordSuccess({
      requestId: "req_a",
      projectId: "proj_001",
      apiKeyId: "key_001",
      provider: "brave",
      capability: "search.web",
      latencyMs: 100,
      resultCount: 5,
      fallbackCount: 0,
    });
    await svc.recordFailure({
      requestId: "req_b",
      projectId: "proj_001",
      apiKeyId: "key_001",
      provider: "brave",
      capability: "search.web",
      statusCode: 500,
      latencyMs: 50,
    });

    const events = await repo.findAll();
    expect(events).toHaveLength(2);
  });
});

/* ------------------------------------------------------------------ */
/*  Audit log persistence                                             */
/* ------------------------------------------------------------------ */

describe("AuditLogRepository persistence", () => {
  let repo: InMemoryAuditLogRepository;
  let svc: AuditService;

  beforeEach(() => {
    repo = new InMemoryAuditLogRepository();
    svc = new AuditService(repo);
  });

  it("auth event persists an audit log entry", async () => {
    await svc.log({
      projectId: "proj_001",
      actorType: "api_key",
      actorId: "key_001",
      action: "search.execute",
      resourceType: "capability",
      resourceId: "search.web",
      details: { provider: "brave", query: "test" },
    });

    const entries = await repo.findAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe("search.execute");
    expect(entries[0].details).toEqual({ provider: "brave", query: "test" });
  });

  it("policy event persists an audit log entry", async () => {
    await svc.log({
      projectId: "proj_001",
      actorType: "api_key",
      actorId: "key_001",
      action: "credential.rotate",
      resourceType: "credential",
      resourceId: "cred_001",
    });

    const entries = await repo.findAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe("credential.rotate");
    expect(entries[0].resourceType).toBe("credential");
  });
});

/* ------------------------------------------------------------------ */
/*  Health snapshot persistence                                       */
/* ------------------------------------------------------------------ */

describe("HealthSnapshotRepository persistence", () => {
  it("health probe results are persisted as snapshots", async () => {
    const snapshotRepo = new InMemoryHealthSnapshotRepository();

    const mockRegistry: ProviderRegistry = {
      list: () => [
        {
          id: "brave",
          capabilities: ["search.web"],
          healthCheck: async () => ({
            status: "healthy" as const,
            latencyMs: 42,
            checkedAt: new Date("2026-03-21T00:00:00Z"),
          }),
          search: async () => ({ results: [], totalResults: 0 }),
        },
      ],
      get: () => undefined,
      register: () => {},
    };

    const healthService = new HealthService({
      registry: mockRegistry,
      resolveHealthCredential: async () => undefined,
      snapshotSink: snapshotRepo,
      cacheTtlMs: 0, // disable caching to force probe
    });

    await healthService.getProviderHealth();

    const snapshots = await snapshotRepo.findAll();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].provider).toBe("brave");
    expect(snapshots[0].status).toBe("healthy");
    expect(snapshots[0].latencyMs).toBe(42);
  });

  it("unavailable provider probe persists snapshot", async () => {
    const snapshotRepo = new InMemoryHealthSnapshotRepository();

    const mockRegistry: ProviderRegistry = {
      list: () => [
        {
          id: "broken",
          capabilities: ["search.web"],
          healthCheck: async () => {
            throw new Error("connection refused");
          },
          search: async () => ({ results: [], totalResults: 0 }),
        },
      ],
      get: () => undefined,
      register: () => {},
    };

    const healthService = new HealthService({
      registry: mockRegistry,
      resolveHealthCredential: async () => undefined,
      snapshotSink: snapshotRepo,
      cacheTtlMs: 0,
    });

    await healthService.getProviderHealth();

    const snapshots = await snapshotRepo.findAll();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].provider).toBe("broken");
    expect(snapshots[0].status).toBe("unavailable");
    expect(snapshots[0].latencyMs).toBeNull();
  });

  it("cached health probe does not persist duplicate snapshots", async () => {
    const snapshotRepo = new InMemoryHealthSnapshotRepository();

    const mockRegistry: ProviderRegistry = {
      list: () => [
        {
          id: "brave",
          capabilities: ["search.web"],
          healthCheck: async () => ({
            status: "healthy" as const,
            latencyMs: 10,
            checkedAt: new Date(),
          }),
          search: async () => ({ results: [], totalResults: 0 }),
        },
      ],
      get: () => undefined,
      register: () => {},
    };

    const healthService = new HealthService({
      registry: mockRegistry,
      resolveHealthCredential: async () => undefined,
      snapshotSink: snapshotRepo,
      cacheTtlMs: 60_000, // long TTL — second call should hit cache
    });

    await healthService.getProviderHealth();
    await healthService.getProviderHealth(); // cache hit

    const snapshots = await snapshotRepo.findAll();
    expect(snapshots).toHaveLength(1); // only one probe, one persist
  });
});
