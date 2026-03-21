/**
 * Per-key control and attribution tests. [Task 24]
 *
 * Proves that different downstream keys can be independently
 * controlled and observed even when they share one Brave upstream path.
 *
 * AC: disabled key rejected without affecting siblings,
 *     usage/audit logs retain key+project attribution,
 *     rate limiting deterministic at project boundary.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app/build-app.js";
import { hashKey } from "../../src/modules/auth/service/auth-service.js";
import { encryptSecret } from "../../src/modules/credentials/service/credential-service.js";
import { randomBytes } from "node:crypto";
import { InMemoryApiKeyRepository } from "../../src/infra/db/repositories/api-key-repository.js";
import { InMemoryProjectRepository } from "../../src/infra/db/repositories/project-repository.js";
import { InMemoryCredentialRepository } from "../../src/infra/db/repositories/credential-repository.js";
import { InMemoryUsageEventRepository } from "../../src/infra/db/repositories/usage-event-repository.js";
import { InMemoryAuditLogRepository } from "../../src/infra/db/repositories/audit-log-repository.js";
import { InMemoryHealthSnapshotRepository } from "../../src/infra/db/repositories/health-snapshot-repository.js";
import { mockBraveFetch } from "../helpers/mock-brave.js";

const PROJECT_ID = "proj_multi_key_001";
const KEY_A_RAW = "sk_key_a_test_per_key_control";
const KEY_A_ID = "key_a_001";
const KEY_B_RAW = "sk_key_b_test_per_key_control";
const KEY_B_ID = "key_b_001";
const ADMIN_KEY = "admin_per_key_test";

function buildRepos() {
  const encryptionKey = randomBytes(32).toString("hex");
  const braveKey = process.env["BRAVE_API_KEY"] ?? "test_brave_key";

  const apiKeyRepository = new InMemoryApiKeyRepository([
    {
      id: KEY_A_ID,
      projectId: PROJECT_ID,
      hashedKey: hashKey(KEY_A_RAW),
      status: "active",
    },
    {
      id: KEY_B_ID,
      projectId: PROJECT_ID,
      hashedKey: hashKey(KEY_B_RAW),
      status: "active",
    },
  ]);

  const projectRepository = new InMemoryProjectRepository();
  projectRepository.seed({
    project: { id: PROJECT_ID, name: "Multi-Key Project", status: "active" },
    bindings: [
      { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
    ],
    defaultProvider: "brave",
  });

  const credentialRepository = new InMemoryCredentialRepository();
  credentialRepository.seed({
    id: "cred_shared_001",
    projectId: PROJECT_ID,
    provider: "brave",
    encryptedSecret: encryptSecret(braveKey, encryptionKey),
    status: "active",
  });

  const usageEventRepository = new InMemoryUsageEventRepository();
  const auditLogRepository = new InMemoryAuditLogRepository();
  const healthSnapshotRepository = new InMemoryHealthSnapshotRepository();

  return {
    apiKeyRepository,
    projectRepository,
    credentialRepository,
    usageEventRepository,
    auditLogRepository,
    healthSnapshotRepository,
    encryptionKey,
  };
}

describe("Per-key control: disabled key rejected without affecting siblings [Task 24]", () => {
  let app: FastifyInstance;
  let repos: ReturnType<typeof buildRepos>;

  beforeAll(async () => {
    repos = buildRepos();
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

  it("both keys authenticate successfully before disabling", async () => {
    const resA = await app.inject({
      method: "GET",
      url: "/v1/health/providers",
      headers: { authorization: `Bearer ${KEY_A_RAW}` },
    });
    expect(resA.statusCode).toBe(200);

    const resB = await app.inject({
      method: "GET",
      url: "/v1/health/providers",
      headers: { authorization: `Bearer ${KEY_B_RAW}` },
    });
    expect(resB.statusCode).toBe(200);
  });

  it("disabling key B does not affect key A", async () => {
    // Disable key B via admin API
    const disableRes = await app.inject({
      method: "POST",
      url: `/v1/admin/keys/${KEY_B_ID}/disable`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(disableRes.statusCode).toBe(200);

    // Key B should be rejected
    const resB = await app.inject({
      method: "GET",
      url: "/v1/health/providers",
      headers: { authorization: `Bearer ${KEY_B_RAW}` },
    });
    expect(resB.statusCode).toBe(401);

    // Key A should still work
    const resA = await app.inject({
      method: "GET",
      url: "/v1/health/providers",
      headers: { authorization: `Bearer ${KEY_A_RAW}` },
    });
    expect(resA.statusCode).toBe(200);
  });
});

describe("Usage event attribution [Task 24]", () => {
  let app: FastifyInstance;
  let repos: ReturnType<typeof buildRepos>;
  let teardown: () => void;

  beforeAll(async () => {
    teardown = mockBraveFetch();
    repos = buildRepos();
    app = await buildApp({ logger: false, ...repos });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    teardown();
  });

  it("usage events retain distinct apiKeyId and projectId per key", async () => {
    // Make a request with key A
    await app.inject({
      method: "POST",
      url: "/v1/search/web",
      headers: { authorization: `Bearer ${KEY_A_RAW}` },
      payload: { query: "key-a-attribution-test" },
    });

    // Make a request with key B
    await app.inject({
      method: "POST",
      url: "/v1/search/web",
      headers: { authorization: `Bearer ${KEY_B_RAW}` },
      payload: { query: "key-b-attribution-test" },
    });

    const events = await repos.usageEventRepository.findAll();

    // Filter to our test requests (there may be events from other tests)
    const keyAEvents = events.filter((e) => e.apiKeyId === KEY_A_ID);
    const keyBEvents = events.filter((e) => e.apiKeyId === KEY_B_ID);

    expect(keyAEvents.length).toBeGreaterThanOrEqual(1);
    expect(keyBEvents.length).toBeGreaterThanOrEqual(1);

    // All events share the same projectId
    for (const e of [...keyAEvents, ...keyBEvents]) {
      expect(e.projectId).toBe(PROJECT_ID);
    }

    // Each event attributes to the correct key
    for (const e of keyAEvents) {
      expect(e.apiKeyId).toBe(KEY_A_ID);
    }
    for (const e of keyBEvents) {
      expect(e.apiKeyId).toBe(KEY_B_ID);
    }
  });
});

describe("Audit log attribution [Task 24]", () => {
  let app: FastifyInstance;
  let repos: ReturnType<typeof buildRepos>;
  let teardown: () => void;

  beforeAll(async () => {
    teardown = mockBraveFetch();
    repos = buildRepos();
    app = await buildApp({ logger: false, ...repos });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    teardown();
  });

  it("audit logs retain distinct actorId (apiKeyId) per key", async () => {
    // Make requests with both keys
    await app.inject({
      method: "POST",
      url: "/v1/search/web",
      headers: { authorization: `Bearer ${KEY_A_RAW}` },
      payload: { query: "audit-key-a" },
    });

    await app.inject({
      method: "POST",
      url: "/v1/search/web",
      headers: { authorization: `Bearer ${KEY_B_RAW}` },
      payload: { query: "audit-key-b" },
    });

    const entries = await repos.auditLogRepository.findAll();

    const keyAEntries = entries.filter((e) => e.actorId === KEY_A_ID);
    const keyBEntries = entries.filter((e) => e.actorId === KEY_B_ID);

    expect(keyAEntries.length).toBeGreaterThanOrEqual(1);
    expect(keyBEntries.length).toBeGreaterThanOrEqual(1);

    // All entries share the same projectId
    for (const e of [...keyAEntries, ...keyBEntries]) {
      expect(e.projectId).toBe(PROJECT_ID);
      expect(e.actorType).toBe("api_key");
      expect(e.action).toBe("search.execute");
    }
  });
});

describe("Rate limiting at project boundary [Task 24]", () => {
  let app: FastifyInstance;
  let repos: ReturnType<typeof buildRepos>;

  beforeAll(async () => {
    repos = buildRepos();
    app = await buildApp({ logger: false, ...repos });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rate limit headers are present and consistent across keys on same project", async () => {
    const resA = await app.inject({
      method: "GET",
      url: "/v1/health/providers",
      headers: { authorization: `Bearer ${KEY_A_RAW}` },
    });

    const resB = await app.inject({
      method: "GET",
      url: "/v1/health/providers",
      headers: { authorization: `Bearer ${KEY_B_RAW}` },
    });

    // Both keys share the same project, so rate limit headers reflect the
    // same counter (key A's request was counted first, then B's).
    const limitA = resA.headers["x-ratelimit-limit"];
    const limitB = resB.headers["x-ratelimit-limit"];
    expect(limitA).toBeDefined();
    expect(limitB).toBeDefined();
    expect(limitA).toBe(limitB); // Same project → same limit

    // Remaining should decrease: B should have 1 fewer remaining than A
    const remainA = Number(resA.headers["x-ratelimit-remaining"]);
    const remainB = Number(resB.headers["x-ratelimit-remaining"]);
    expect(remainA).toBeGreaterThan(remainB);
    expect(remainA - remainB).toBe(1); // Exactly one request between them
  });

  it("requests from different keys on same project share the rate limit counter", async () => {
    // Make 3 requests with key A and 2 with key B
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: "GET",
        url: "/v1/health/providers",
        headers: { authorization: `Bearer ${KEY_A_RAW}` },
      });
    }

    const res = await app.inject({
      method: "GET",
      url: "/v1/health/providers",
      headers: { authorization: `Bearer ${KEY_B_RAW}` },
    });

    // The remaining count reflects all requests (A's + B's), not just B's
    const remaining = Number(res.headers["x-ratelimit-remaining"]);
    const limit = Number(res.headers["x-ratelimit-limit"]);

    // We've made at least 6 total requests (2 from prev test + 3 A + 1 B here)
    // so remaining should be limit minus total requests
    expect(remaining).toBeLessThan(limit);
    expect(remaining).toBeLessThanOrEqual(limit - 6);
  });
});
