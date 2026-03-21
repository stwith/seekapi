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
});
