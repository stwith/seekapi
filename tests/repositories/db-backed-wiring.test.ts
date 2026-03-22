/**
 * Integration tests for DB-backed runtime wiring. [AC2]
 *
 * Verifies that:
 * - buildApp works with any repository implementation
 * - bootstrapFromEnv selects Drizzle repos when DATABASE_URL is set
 * - bootstrapFromEnv selects in-memory repos when DATABASE_URL is absent
 */

import { describe, test, expect, vi, afterEach } from "vitest";
import { buildApp } from "../../src/app/build-app.js";
import { seedTestRepositories, TEST_API_KEY } from "../helpers/seed-test-repos.js";
import { DrizzleApiKeyRepository } from "../../src/infra/db/repositories/api-key-repository.js";
import { DrizzleProjectRepository } from "../../src/infra/db/repositories/project-repository.js";
import { DrizzleCredentialRepository } from "../../src/infra/db/repositories/credential-repository.js";
import { DrizzleUsageEventRepository } from "../../src/infra/db/repositories/usage-event-repository.js";
import { DrizzleAuditLogRepository } from "../../src/infra/db/repositories/audit-log-repository.js";
import { DrizzleHealthSnapshotRepository } from "../../src/infra/db/repositories/health-snapshot-repository.js";
import { InMemoryApiKeyRepository } from "../../src/infra/db/repositories/api-key-repository.js";
import { InMemoryProjectRepository } from "../../src/infra/db/repositories/project-repository.js";
import { InMemoryCredentialRepository } from "../../src/infra/db/repositories/credential-repository.js";

describe("buildApp accepts any repository implementation [AC2]", () => {
  test("works with in-memory repos (no DATABASE_URL)", async () => {
    const repos = seedTestRepositories();
    const app = await buildApp({ logger: false, ...repos });
    await app.ready();

    const res = await app.inject({
      method: "GET",
      url: "/v1/health/providers",
      headers: { authorization: `Bearer ${TEST_API_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().providers).toHaveLength(3);

    const healthRes = await app.inject({
      method: "GET",
      url: "/v1/health",
    });
    expect(healthRes.statusCode).toBe(200);
    expect(healthRes.json().status).toBe("ok");

    await app.close();
  });

  test("buildApp composition works with healthProbeProjectId", async () => {
    const repos = seedTestRepositories();
    const app = await buildApp({
      logger: false,
      ...repos,
      healthProbeProjectId: "proj_demo_001",
    });
    await app.ready();

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ web: { results: [] } }), { status: 200 });

    try {
      const res = await app.inject({
        method: "GET",
        url: "/v1/health/providers",
        headers: { authorization: `Bearer ${TEST_API_KEY}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().providers[0].status).toBe("healthy");
    } finally {
      globalThis.fetch = originalFetch;
    }

    await app.close();
  });
});

describe("bootstrapFromEnv selects correct repository implementations [AC2]", () => {
  const savedEnv: Record<string, string | undefined> = {};

  afterEach(() => {
    // Restore environment
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    vi.restoreAllMocks();
  });

  function setEnv(key: string, value: string | undefined) {
    savedEnv[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  test("returns in-memory repos when DATABASE_URL is not set", async () => {
    setEnv("DATABASE_URL", undefined);
    setEnv("ENCRYPTION_KEY", "0".repeat(64));

    const { bootstrapFromEnv } = await import("../../src/app/bootstrap.js");
    const result = bootstrapFromEnv();

    expect(result.apiKeyRepository).toBeInstanceOf(InMemoryApiKeyRepository);
    expect(result.projectRepository).toBeInstanceOf(InMemoryProjectRepository);
    expect(result.credentialRepository).toBeInstanceOf(InMemoryCredentialRepository);
    expect(result.encryptionKey).toBe("0".repeat(64));
  });

  test("returns Drizzle repos when DATABASE_URL is set", async () => {
    setEnv("DATABASE_URL", "postgresql://fake:fake@localhost:5432/fake");
    setEnv("ENCRYPTION_KEY", "0".repeat(64));

    // Mock createDbClient since we don't have a real DB
    const mockDb = {} as never;
    vi.doMock("../../src/infra/db/client.js", () => ({
      createDbClient: () => ({ db: mockDb, pool: {} }),
    }));

    // Re-import to pick up the mock
    const { bootstrapFromEnv } = await import("../../src/app/bootstrap.js");
    const result = bootstrapFromEnv();

    expect(result.apiKeyRepository).toBeInstanceOf(DrizzleApiKeyRepository);
    expect(result.projectRepository).toBeInstanceOf(DrizzleProjectRepository);
    expect(result.credentialRepository).toBeInstanceOf(DrizzleCredentialRepository);
    expect(result.usageEventRepository).toBeInstanceOf(DrizzleUsageEventRepository);
    expect(result.auditLogRepository).toBeInstanceOf(DrizzleAuditLogRepository);
    expect(result.healthSnapshotRepository).toBeInstanceOf(DrizzleHealthSnapshotRepository);
    expect(result.encryptionKey).toBe("0".repeat(64));
  });

  test("throws when ENCRYPTION_KEY is missing", async () => {
    setEnv("ENCRYPTION_KEY", undefined);
    setEnv("DATABASE_URL", undefined);

    const { bootstrapFromEnv } = await import("../../src/app/bootstrap.js");
    expect(() => bootstrapFromEnv()).toThrow(/ENCRYPTION_KEY is required/);
  });
});
