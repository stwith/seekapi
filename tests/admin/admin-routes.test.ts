/**
 * Admin API route tests. [AC3]
 *
 * Covers:
 * - Admin auth (ADMIN_API_KEY)
 * - Project creation
 * - API key creation and disabling
 * - Credential attach / rotate
 * - Binding configuration
 * - End-to-end: create project → attach credential → mint key → search
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app/build-app.js";
import { seedTestRepositories, TEST_API_KEY } from "../helpers/seed-test-repos.js";

const ADMIN_KEY = "admin_test_key_001";

describe("Admin routes [AC3]", () => {
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

  it("rejects requests without admin key", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/admin/projects",
      payload: { name: "Test" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects requests with wrong admin key", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/admin/projects",
      headers: { authorization: "Bearer wrong_key" },
      payload: { name: "Test" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects requests with downstream API key (not admin key)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/admin/projects",
      headers: { authorization: `Bearer ${TEST_API_KEY}` },
      payload: { name: "Test" },
    });
    expect(res.statusCode).toBe(403);
  });

  // --- Create project ---

  it("creates a project", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/admin/projects",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { name: "New Project" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.name).toBe("New Project");
    expect(body.status).toBe("active");
  });

  it("rejects project creation without name", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/admin/projects",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  // --- Create API key ---

  it("creates an API key for an existing project", async () => {
    // First create a project
    const projRes = await app.inject({
      method: "POST",
      url: "/v1/admin/projects",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { name: "Key Test Project" },
    });
    const project = projRes.json();

    const res = await app.inject({
      method: "POST",
      url: `/v1/admin/projects/${project.id}/keys`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.projectId).toBe(project.id);
    expect(body.rawKey).toBeDefined();
    expect(body.rawKey).toMatch(/^sk_/);
  });

  it("returns 404 for API key on non-existent project", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/admin/projects/non_existent_project/keys",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(404);
  });

  // --- Disable API key ---

  it("disables an API key", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/admin/keys/some_key_id/disable",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("disabled");
  });

  // --- Attach / rotate credential ---

  it("attaches a credential to a project", async () => {
    // Create project first
    const projRes = await app.inject({
      method: "POST",
      url: "/v1/admin/projects",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { name: "Cred Test Project" },
    });
    const project = projRes.json();

    const res = await app.inject({
      method: "POST",
      url: `/v1/admin/projects/${project.id}/credentials`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { provider: "brave", secret: "BSA_test_key" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
  });

  it("rejects unsupported provider for credential", async () => {
    const projRes = await app.inject({
      method: "POST",
      url: "/v1/admin/projects",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { name: "Provider Reject Test" },
    });
    const project = projRes.json();

    const res = await app.inject({
      method: "POST",
      url: `/v1/admin/projects/${project.id}/credentials`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { provider: "google", secret: "some_key" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("BAD_REQUEST");
    expect(res.json().message).toContain("google");
  });

  it("rejects credential without required fields", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/admin/projects/some_project/credentials",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { provider: "brave" }, // missing secret
    });
    expect(res.statusCode).toBe(400);
  });

  // --- Configure binding ---

  it("configures a binding for a project", async () => {
    // Create project first
    const projRes = await app.inject({
      method: "POST",
      url: "/v1/admin/projects",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { name: "Binding Test Project" },
    });
    const project = projRes.json();

    const res = await app.inject({
      method: "POST",
      url: `/v1/admin/projects/${project.id}/bindings`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("configured");
  });

  it("rejects unsupported provider for binding", async () => {
    const projRes = await app.inject({
      method: "POST",
      url: "/v1/admin/projects",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { name: "Binding Provider Reject" },
    });
    const project = projRes.json();

    const res = await app.inject({
      method: "POST",
      url: `/v1/admin/projects/${project.id}/bindings`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { provider: "google", capability: "search.web" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("google");
  });

  it("rejects unsupported capability for binding", async () => {
    const projRes = await app.inject({
      method: "POST",
      url: "/v1/admin/projects",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { name: "Binding Cap Reject" },
    });
    const project = projRes.json();

    const res = await app.inject({
      method: "POST",
      url: `/v1/admin/projects/${project.id}/bindings`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { provider: "brave", capability: "search.answer" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("search.answer");
  });

  it("rejects binding without required fields", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/admin/projects/some_project/bindings",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { provider: "brave" }, // missing capability
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("Admin read endpoints [Phase 3 AC4]", () => {
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

  it("lists projects", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/admin/projects",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    // Seeded data has at least the demo project
    expect(body.length).toBeGreaterThanOrEqual(1);
    expect(body[0].id).toBeDefined();
    expect(body[0].name).toBeDefined();
  });

  it("gets project detail", async () => {
    // Create a project and populate it
    const projRes = await app.inject({
      method: "POST",
      url: "/v1/admin/projects",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { name: "Detail Test Project" },
    });
    const project = projRes.json();

    // Add binding
    await app.inject({
      method: "POST",
      url: `/v1/admin/projects/${project.id}/bindings`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
    });

    // Add credential
    await app.inject({
      method: "POST",
      url: `/v1/admin/projects/${project.id}/credentials`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { provider: "brave", secret: "BSA_test_read" },
    });

    // Mint a key
    await app.inject({
      method: "POST",
      url: `/v1/admin/projects/${project.id}/keys`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });

    const res = await app.inject({
      method: "GET",
      url: `/v1/admin/projects/${project.id}`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    const detail = res.json();
    expect(detail.project.id).toBe(project.id);
    expect(detail.bindings.length).toBe(1);
    expect(detail.bindings[0].capability).toBe("search.web");
    expect(detail.keys.length).toBe(1);
    expect(detail.keys[0].status).toBe("active");
    // Credential metadata present without raw secret [Phase 4D AC6]
    expect(detail.credentials).toBeInstanceOf(Array);
    expect(detail.credentials.length).toBe(1);
    expect(detail.credentials[0].provider).toBe("brave");
    expect(detail.credentials[0].encryptedSecret).toBeUndefined();
  });

  it("returns 404 for non-existent project detail", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/admin/projects/nonexistent",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("lists project keys", async () => {
    const projRes = await app.inject({
      method: "POST",
      url: "/v1/admin/projects",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { name: "Key List Project" },
    });
    const project = projRes.json();

    await app.inject({
      method: "POST",
      url: `/v1/admin/projects/${project.id}/keys`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });

    const res = await app.inject({
      method: "GET",
      url: `/v1/admin/projects/${project.id}/keys`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    const keys = res.json();
    expect(Array.isArray(keys)).toBe(true);
    expect(keys.length).toBe(1);
    expect(keys[0].status).toBe("active");
    // Must not contain hashedKey
    expect(keys[0].hashedKey).toBeUndefined();
  });

  it("lists project bindings", async () => {
    const projRes = await app.inject({
      method: "POST",
      url: "/v1/admin/projects",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { name: "Binding List Project" },
    });
    const project = projRes.json();

    await app.inject({
      method: "POST",
      url: `/v1/admin/projects/${project.id}/bindings`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
    });

    const res = await app.inject({
      method: "GET",
      url: `/v1/admin/projects/${project.id}/bindings`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    const bindings = res.json();
    expect(Array.isArray(bindings)).toBe(true);
    expect(bindings.length).toBe(1);
    expect(bindings[0].capability).toBe("search.web");
  });

  it("gets credential metadata without raw secret", async () => {
    const projRes = await app.inject({
      method: "POST",
      url: "/v1/admin/projects",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { name: "Cred Meta Project" },
    });
    const project = projRes.json();

    await app.inject({
      method: "POST",
      url: `/v1/admin/projects/${project.id}/credentials`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { provider: "brave", secret: "BSA_meta_test" },
    });

    const res = await app.inject({
      method: "GET",
      url: `/v1/admin/projects/${project.id}/credentials`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    const meta = res.json();
    expect(Array.isArray(meta)).toBe(true);
    expect(meta.length).toBe(1);
    expect(meta[0].provider).toBe("brave");
    expect(meta[0].status).toBe("active");
    // Must not contain encrypted secret
    expect(meta[0].encryptedSecret).toBeUndefined();
    expect(meta[0].secret).toBeUndefined();
  });

  it("returns empty array when no credentials attached", async () => {
    const projRes = await app.inject({
      method: "POST",
      url: "/v1/admin/projects",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { name: "No Cred Project" },
    });
    const project = projRes.json();

    const res = await app.inject({
      method: "GET",
      url: `/v1/admin/projects/${project.id}/credentials`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("returns multiple provider credentials for a project [Phase 4D AC6]", async () => {
    const projRes = await app.inject({
      method: "POST",
      url: "/v1/admin/projects",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { name: "Multi Cred Project" },
    });
    const project = projRes.json();

    // Attach credentials for two different providers
    await app.inject({
      method: "POST",
      url: `/v1/admin/projects/${project.id}/credentials`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { provider: "brave", secret: "BSA_multi_1" },
    });
    await app.inject({
      method: "POST",
      url: `/v1/admin/projects/${project.id}/credentials`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { provider: "tavily", secret: "tvly_multi_2" },
    });

    // Verify credentials list endpoint returns both
    const credRes = await app.inject({
      method: "GET",
      url: `/v1/admin/projects/${project.id}/credentials`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(credRes.statusCode).toBe(200);
    const creds = credRes.json();
    expect(Array.isArray(creds)).toBe(true);
    expect(creds.length).toBe(2);
    const providers = creds.map((c: { provider: string }) => c.provider).sort();
    expect(providers).toEqual(["brave", "tavily"]);

    // Verify project detail also returns both credentials
    const detailRes = await app.inject({
      method: "GET",
      url: `/v1/admin/projects/${project.id}`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(detailRes.statusCode).toBe(200);
    const detail = detailRes.json();
    expect(detail.credentials.length).toBe(2);
    const detailProviders = detail.credentials.map((c: { provider: string }) => c.provider).sort();
    expect(detailProviders).toEqual(["brave", "tavily"]);
  });

  it("requires admin auth on read endpoints", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/admin/projects",
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("Admin end-to-end flow [AC3]", () => {
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

  it("create project → configure binding → attach credential → mint key → authenticate", async () => {
    // 1. Create project
    const projRes = await app.inject({
      method: "POST",
      url: "/v1/admin/projects",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { name: "E2E Test Project" },
    });
    expect(projRes.statusCode).toBe(201);
    const project = projRes.json();

    // 2. Configure Brave binding
    const bindRes = await app.inject({
      method: "POST",
      url: `/v1/admin/projects/${project.id}/bindings`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
    });
    expect(bindRes.statusCode).toBe(200);

    // 3. Attach Brave credential
    const credRes = await app.inject({
      method: "POST",
      url: `/v1/admin/projects/${project.id}/credentials`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { provider: "brave", secret: "BSA_e2e_test_key" },
    });
    expect(credRes.statusCode).toBe(201);

    // 4. Mint downstream API key
    const keyRes = await app.inject({
      method: "POST",
      url: `/v1/admin/projects/${project.id}/keys`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(keyRes.statusCode).toBe(201);
    const key = keyRes.json();
    expect(key.rawKey).toMatch(/^sk_/);

    // 5. Authenticate with the new key
    const authRes = await app.inject({
      method: "GET",
      url: "/v1/health/providers",
      headers: { authorization: `Bearer ${key.rawKey}` },
    });
    expect(authRes.statusCode).toBe(200);
  });

  it("admin routes do not interfere with downstream auth", async () => {
    // Downstream API key still works for search endpoints
    const res = await app.inject({
      method: "GET",
      url: "/v1/health/providers",
      headers: { authorization: `Bearer ${TEST_API_KEY}` },
    });
    expect(res.statusCode).toBe(200);
  });

  // --- Fix 1: Global credential API rejects project-scoped credentials ---

  it("rejects update of project-scoped credential via global API (422)", async () => {
    // Create a project and attach a project-scoped credential
    const projRes = await app.inject({
      method: "POST",
      url: "/v1/admin/projects",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { name: "Scoped Cred Test" },
    });
    expect(projRes.statusCode).toBe(201);
    const project = projRes.json();
    const credRes = await app.inject({
      method: "POST",
      url: `/v1/admin/projects/${project.id}/credentials`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { provider: "brave", secret: "proj_secret" },
    });
    expect(credRes.statusCode).toBe(201);
    const { id: credId } = credRes.json();
    expect(credId).toBeDefined();

    // Try to update via global API
    const updateRes = await app.inject({
      method: "PUT",
      url: `/v1/admin/credentials/${credId}`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { name: "hacked" },
    });
    expect(updateRes.statusCode).toBe(422);
    expect(updateRes.json().error).toBe("NOT_GLOBAL_CREDENTIAL");
  });

  it("rejects delete of project-scoped credential via global API (422)", async () => {
    const projRes = await app.inject({
      method: "POST",
      url: "/v1/admin/projects",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { name: "Scoped Del Test" },
    });
    const project = projRes.json();
    const credRes = await app.inject({
      method: "POST",
      url: `/v1/admin/projects/${project.id}/credentials`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { provider: "brave", secret: "proj_secret_del" },
    });
    const { id: credId } = credRes.json();

    const delRes = await app.inject({
      method: "DELETE",
      url: `/v1/admin/credentials/${credId}`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(delRes.statusCode).toBe(422);
    expect(delRes.json().error).toBe("NOT_GLOBAL_CREDENTIAL");
  });

  // --- Fix 2: addCredentialRef rejects non-global / inactive credentials ---

  it("rejects credential ref to project-scoped credential (422)", async () => {
    // Create two projects
    const projARes = await app.inject({
      method: "POST",
      url: "/v1/admin/projects",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { name: "Project A" },
    });
    const projA = projARes.json();
    const projBRes = await app.inject({
      method: "POST",
      url: "/v1/admin/projects",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { name: "Project B" },
    });
    const projB = projBRes.json();

    // Attach credential to project A (project-scoped)
    const credRes = await app.inject({
      method: "POST",
      url: `/v1/admin/projects/${projA.id}/credentials`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { provider: "brave", secret: "projA_secret" },
    });
    const { id: credId } = credRes.json();

    // Try to reference project A's credential from project B
    const refRes = await app.inject({
      method: "POST",
      url: `/v1/admin/projects/${projB.id}/credential-refs`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { credentialId: credId },
    });
    expect(refRes.statusCode).toBe(422);
    expect(refRes.json().error).toBe("NOT_GLOBAL_CREDENTIAL");
  });

  it("rejects credential ref to deleted global credential (422)", async () => {
    // Create global credential
    const credRes = await app.inject({
      method: "POST",
      url: "/v1/admin/credentials",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { provider: "brave", name: "will-delete", secret: "del_secret" },
    });
    const { id: credId } = credRes.json();

    // Delete it
    await app.inject({
      method: "DELETE",
      url: `/v1/admin/credentials/${credId}`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });

    // Create project and try to ref deleted credential
    const projRes = await app.inject({
      method: "POST",
      url: "/v1/admin/projects",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { name: "Ref Deleted Test" },
    });
    const project = projRes.json();

    const refRes = await app.inject({
      method: "POST",
      url: `/v1/admin/projects/${project.id}/credential-refs`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { credentialId: credId },
    });
    expect(refRes.statusCode).toBe(422);
    expect(refRes.json().error).toBe("CREDENTIAL_NOT_ACTIVE");
  });

  // --- Fix 3: Credential ref dedup (idempotent) ---

  it("duplicate credential ref is idempotent (no error, single ref)", async () => {
    // Create global credential
    const credRes = await app.inject({
      method: "POST",
      url: "/v1/admin/credentials",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { provider: "brave", name: "dedup-test", secret: "dedup_secret" },
    });
    const { id: credId } = credRes.json();

    // Create project
    const projRes = await app.inject({
      method: "POST",
      url: "/v1/admin/projects",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { name: "Dedup Ref Test" },
    });
    const project = projRes.json();

    // Add ref twice
    const ref1 = await app.inject({
      method: "POST",
      url: `/v1/admin/projects/${project.id}/credential-refs`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { credentialId: credId },
    });
    expect(ref1.statusCode).toBe(201);

    const ref2 = await app.inject({
      method: "POST",
      url: `/v1/admin/projects/${project.id}/credential-refs`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { credentialId: credId },
    });
    expect(ref2.statusCode).toBe(201);

    // Should only have one ref
    const listRes = await app.inject({
      method: "GET",
      url: `/v1/admin/projects/${project.id}/credential-refs`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    const refs = listRes.json();
    expect(refs.credentials.length).toBe(1);
  });

  // --- AC1: maxKeys enforcement ---
  it("rejects key creation when maxKeys quota is reached", async () => {
    // Create a fresh project
    const projRes = await app.inject({
      method: "POST",
      url: "/v1/admin/projects",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { name: "Quota Test Project" },
    });
    const proj = projRes.json();

    // Set maxKeys = 1 via quota
    await app.inject({
      method: "PUT",
      url: `/v1/admin/projects/${proj.id}/quota`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { maxKeys: 1, rateLimitRpm: 60 },
    });

    // Create first key — should succeed
    const key1Res = await app.inject({
      method: "POST",
      url: `/v1/admin/projects/${proj.id}/keys`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(key1Res.statusCode).toBe(201);

    // Create second key — should fail with 422
    const key2Res = await app.inject({
      method: "POST",
      url: `/v1/admin/projects/${proj.id}/keys`,
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(key2Res.statusCode).toBe(422);
    expect(key2Res.json().error).toBe("MAX_KEYS_EXCEEDED");
  });

  // --- AC5: removeCredentialRef for non-existent project ---
  it("returns 404 when removing credential ref for non-existent project", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/v1/admin/projects/proj_nonexistent/credential-refs/cred_fake",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("NOT_FOUND");
  });
});
