/**
 * Multi-provider integration test: proves the full request pipeline works
 * across all four registered providers (Brave, Tavily, Kagi, SerpAPI).
 *
 * Covers [Phase 4E][Task 58]:
 * - Default provider selection through project bindings
 * - Fallback behavior when primary provider fails
 * - Explicit provider selection via request field
 * - Disabled binding exclusion
 * - Provider attribution in response
 * - Canonical route neutrality [AC4]
 *
 * All provider HTTP calls are mocked at the fetch level.
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app/build-app.js";
import { randomBytes } from "node:crypto";
import { hashKey } from "../../src/modules/auth/service/auth-service.js";
import { encryptSecret } from "../../src/modules/credentials/service/credential-service.js";
import { InMemoryApiKeyRepository } from "../../src/infra/db/repositories/api-key-repository.js";
import { InMemoryProjectRepository } from "../../src/infra/db/repositories/project-repository.js";
import { InMemoryCredentialRepository } from "../../src/infra/db/repositories/credential-repository.js";
import { InMemoryUsageEventRepository } from "../../src/infra/db/repositories/usage-event-repository.js";
import { InMemoryAuditLogRepository } from "../../src/infra/db/repositories/audit-log-repository.js";
import { InMemoryHealthSnapshotRepository } from "../../src/infra/db/repositories/health-snapshot-repository.js";
import { InMemoryQuotaRepository } from "../../src/infra/db/repositories/quota-repository.js";

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const TEST_PROJECT_ID = "proj_mp_001";
const TEST_API_KEY = "sk_multi_provider_test_key";
const TEST_API_KEY_ID = "key_mp_001";
const AUTH = { authorization: `Bearer ${TEST_API_KEY}` };

/* ------------------------------------------------------------------ */
/*  Mock provider responses                                           */
/* ------------------------------------------------------------------ */

const BRAVE_RESPONSE = {
  query: { original: "test" },
  web: { results: [{ title: "Brave Web", url: "https://brave.com", description: "From Brave" }] },
  news: { results: [{ title: "Brave News", url: "https://brave.com/news", description: "Brave news", age: "1h" }] },
  images: { results: [{ title: "Brave Img", url: "https://brave.com/img.jpg", thumbnail: { src: "https://brave.com/thumb.jpg" }, source: "brave.com" }] },
};

const TAVILY_RESPONSE = {
  results: [{ title: "Tavily Web", url: "https://tavily.com", content: "From Tavily", score: 0.9 }],
};

const KAGI_RESPONSE = {
  meta: { id: "k1", node: "n1", ms: 50 },
  data: [{ t: 0, url: "https://kagi.com", title: "Kagi Web", snippet: "From Kagi" }],
};

const SERPAPI_WEB_RESPONSE = {
  search_metadata: { id: "s1", status: "Success" },
  organic_results: [{ title: "SerpAPI Web", link: "https://serpapi.com", snippet: "From SerpAPI" }],
};

const SERPAPI_NEWS_RESPONSE = {
  search_metadata: { id: "s2", status: "Success" },
  news_results: [{ title: "SerpAPI News", link: "https://serpapi.com/news", snippet: "From SerpAPI" }],
};

const SERPAPI_IMAGES_RESPONSE = {
  search_metadata: { id: "s3", status: "Success" },
  images_results: [{ title: "SerpAPI Img", link: "https://serpapi.com/img", original: "https://serpapi.com/img.jpg", thumbnail: "https://serpapi.com/thumb.jpg" }],
};

/* ------------------------------------------------------------------ */
/*  Fetch mock: routes by URL to the correct provider response        */
/* ------------------------------------------------------------------ */

function installMultiProviderFetchMock(overrides?: {
  braveStatus?: number;
  tavilyStatus?: number;
  kagiStatus?: number;
  serpapiStatus?: number;
}): () => void {
  const original = globalThis.fetch;
  const braveStatus = overrides?.braveStatus ?? 200;
  const tavilyStatus = overrides?.tavilyStatus ?? 200;
  const kagiStatus = overrides?.kagiStatus ?? 200;
  const serpapiStatus = overrides?.serpapiStatus ?? 200;

  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.includes("api.search.brave.com")) {
      if (braveStatus !== 200) {
        return Promise.resolve(new Response("{}", { status: braveStatus }));
      }
      return Promise.resolve(new Response(JSON.stringify(BRAVE_RESPONSE), { status: 200, headers: { "Content-Type": "application/json" } }));
    }
    if (url.includes("api.tavily.com")) {
      if (tavilyStatus !== 200) {
        return Promise.resolve(new Response("{}", { status: tavilyStatus }));
      }
      return Promise.resolve(new Response(JSON.stringify(TAVILY_RESPONSE), { status: 200, headers: { "Content-Type": "application/json" } }));
    }
    if (url.includes("kagi.com")) {
      if (kagiStatus !== 200) {
        return Promise.resolve(new Response("{}", { status: kagiStatus }));
      }
      return Promise.resolve(new Response(JSON.stringify(KAGI_RESPONSE), { status: 200, headers: { "Content-Type": "application/json" } }));
    }
    if (url.includes("serpapi.com")) {
      if (serpapiStatus !== 200) {
        return Promise.resolve(new Response("{}", { status: serpapiStatus }));
      }
      // SerpAPI uses query params to determine result type
      if (url.includes("tbm=nws")) {
        return Promise.resolve(new Response(JSON.stringify(SERPAPI_NEWS_RESPONSE), { status: 200, headers: { "Content-Type": "application/json" } }));
      }
      if (url.includes("tbm=isch")) {
        return Promise.resolve(new Response(JSON.stringify(SERPAPI_IMAGES_RESPONSE), { status: 200, headers: { "Content-Type": "application/json" } }));
      }
      return Promise.resolve(new Response(JSON.stringify(SERPAPI_WEB_RESPONSE), { status: 200, headers: { "Content-Type": "application/json" } }));
    }

    return original(input, init);
  };

  return () => { globalThis.fetch = original; };
}

/* ------------------------------------------------------------------ */
/*  App builder with multi-provider project bindings                  */
/* ------------------------------------------------------------------ */

function buildMultiProviderApp(bindingOverrides?: {
  bindings?: { provider: string; capability: string; enabled: boolean; priority: number }[];
  defaultProvider?: string;
}): Promise<FastifyInstance> {
  const encryptionKey = randomBytes(32).toString("hex");

  const apiKeyRepository = new InMemoryApiKeyRepository([
    { id: TEST_API_KEY_ID, projectId: TEST_PROJECT_ID, hashedKey: hashKey(TEST_API_KEY), status: "active" },
  ]);

  const projectRepository = new InMemoryProjectRepository();
  projectRepository.seed({
    project: { id: TEST_PROJECT_ID, name: "Multi-Provider Test", status: "active" },
    bindings: bindingOverrides?.bindings ?? [
      { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
      { provider: "tavily", capability: "search.web", enabled: true, priority: 1 },
      { provider: "kagi", capability: "search.web", enabled: true, priority: 2 },
      { provider: "serpapi", capability: "search.web", enabled: true, priority: 3 },
      { provider: "brave", capability: "search.news", enabled: true, priority: 0 },
      { provider: "kagi", capability: "search.news", enabled: true, priority: 1 },
      { provider: "serpapi", capability: "search.news", enabled: true, priority: 2 },
      { provider: "brave", capability: "search.images", enabled: true, priority: 0 },
      { provider: "serpapi", capability: "search.images", enabled: true, priority: 1 },
    ],
    defaultProvider: bindingOverrides?.defaultProvider ?? "brave",
  });

  const credentialRepository = new InMemoryCredentialRepository();
  for (const provider of ["brave", "tavily", "kagi", "serpapi"]) {
    credentialRepository.seed({
      id: `cred_${provider}_001`,
      projectId: TEST_PROJECT_ID,
      provider,
      encryptedSecret: encryptSecret(`test_${provider}_key`, encryptionKey),
      status: "active",
    });
  }

  return buildApp({
    logger: false,
    apiKeyRepository,
    projectRepository,
    credentialRepository,
    usageEventRepository: new InMemoryUsageEventRepository(),
    auditLogRepository: new InMemoryAuditLogRepository(),
    healthSnapshotRepository: new InMemoryHealthSnapshotRepository(),
    quotaRepository: new InMemoryQuotaRepository(),
    encryptionKey,
  });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

// AC2: default provider selection through project bindings
describe("Multi-provider default selection [AC2][Task 58]", () => {
  let app: FastifyInstance;
  let restore: () => void;

  beforeEach(async () => {
    restore = installMultiProviderFetchMock();
    app = await buildMultiProviderApp();
    await app.ready();
  });

  afterEach(() => {
    restore();
  });

  test("search.web defaults to brave (priority 0 binding)", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/search/web", payload: { query: "test" }, headers: AUTH });
    expect(res.statusCode).toBe(200);
    expect(res.json().provider).toBe("brave");
    expect(res.json().items[0].title).toBe("Brave Web");
  });

  test("search.news defaults to brave", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/search/news", payload: { query: "test" }, headers: AUTH });
    expect(res.statusCode).toBe(200);
    expect(res.json().provider).toBe("brave");
  });

  test("search.images defaults to brave", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/search/images", payload: { query: "test" }, headers: AUTH });
    expect(res.statusCode).toBe(200);
    expect(res.json().provider).toBe("brave");
  });
});

// AC2: fallback across providers through the full HTTP stack
describe("Multi-provider fallback [AC2][Task 58]", () => {
  let app: FastifyInstance;
  let restore: () => void;

  beforeEach(async () => {
    // Brave returns 503, others succeed
    restore = installMultiProviderFetchMock({ braveStatus: 503 });
    app = await buildMultiProviderApp();
    await app.ready();
  });

  afterEach(() => {
    restore();
  });

  test("search.web falls back from brave to tavily on 503", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/search/web", payload: { query: "test" }, headers: AUTH });
    expect(res.statusCode).toBe(200);
    expect(res.json().provider).toBe("tavily");
    expect(res.json().items[0].title).toBe("Tavily Web");
  });

  test("search.news falls back from brave to kagi on 503", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/search/news", payload: { query: "test" }, headers: AUTH });
    expect(res.statusCode).toBe(200);
    expect(res.json().provider).toBe("kagi");
  });

  test("search.images falls back from brave to serpapi on 503", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/search/images", payload: { query: "test" }, headers: AUTH });
    expect(res.statusCode).toBe(200);
    expect(res.json().provider).toBe("serpapi");
  });
});

// AC2: explicit provider selection
describe("Multi-provider explicit selection [AC2][Task 58]", () => {
  let app: FastifyInstance;
  let restore: () => void;

  beforeEach(async () => {
    restore = installMultiProviderFetchMock();
    app = await buildMultiProviderApp();
    await app.ready();
  });

  afterEach(() => {
    restore();
  });

  test("explicit provider: tavily routes search.web to tavily", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/search/web", payload: { query: "test", provider: "tavily" }, headers: AUTH });
    expect(res.statusCode).toBe(200);
    expect(res.json().provider).toBe("tavily");
  });

  test("explicit provider: kagi routes search.web to kagi", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/search/web", payload: { query: "test", provider: "kagi" }, headers: AUTH });
    expect(res.statusCode).toBe(200);
    expect(res.json().provider).toBe("kagi");
  });

  test("explicit provider: serpapi routes search.web to serpapi", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/search/web", payload: { query: "test", provider: "serpapi" }, headers: AUTH });
    expect(res.statusCode).toBe(200);
    expect(res.json().provider).toBe("serpapi");
  });

  test("explicit provider: serpapi routes search.images to serpapi", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/search/images", payload: { query: "test", provider: "serpapi" }, headers: AUTH });
    expect(res.statusCode).toBe(200);
    expect(res.json().provider).toBe("serpapi");
  });
});

// AC2: disabled binding exclusion
describe("Disabled binding exclusion [AC2][Task 58]", () => {
  let app: FastifyInstance;
  let restore: () => void;

  beforeEach(async () => {
    restore = installMultiProviderFetchMock();
    app = await buildMultiProviderApp({
      bindings: [
        { provider: "brave", capability: "search.web", enabled: false, priority: 0 },
        { provider: "tavily", capability: "search.web", enabled: true, priority: 1 },
        { provider: "kagi", capability: "search.web", enabled: true, priority: 2 },
      ],
      defaultProvider: "brave",
    });
    await app.ready();
  });

  afterEach(() => {
    restore();
  });

  test("skips disabled brave binding and routes to tavily", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/search/web", payload: { query: "test" }, headers: AUTH });
    expect(res.statusCode).toBe(200);
    // Brave is disabled so should skip to tavily
    expect(res.json().provider).toBe("tavily");
  });
});

// AC3: provider attribution in usage events
describe("Provider attribution [AC3][Task 58]", () => {
  let app: FastifyInstance;
  let restore: () => void;
  let usageRepo: InMemoryUsageEventRepository;

  beforeEach(async () => {
    restore = installMultiProviderFetchMock();
    usageRepo = new InMemoryUsageEventRepository();
    const encryptionKey = randomBytes(32).toString("hex");

    const apiKeyRepository = new InMemoryApiKeyRepository([
      { id: TEST_API_KEY_ID, projectId: TEST_PROJECT_ID, hashedKey: hashKey(TEST_API_KEY), status: "active" },
    ]);

    const projectRepository = new InMemoryProjectRepository();
    projectRepository.seed({
      project: { id: TEST_PROJECT_ID, name: "Attribution Test", status: "active" },
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
        { provider: "tavily", capability: "search.web", enabled: true, priority: 1 },
      ],
      defaultProvider: "brave",
    });

    const credentialRepository = new InMemoryCredentialRepository();
    credentialRepository.seed({
      id: "cred_brave_attr",
      projectId: TEST_PROJECT_ID,
      provider: "brave",
      encryptedSecret: encryptSecret("test_brave", encryptionKey),
      status: "active",
    });
    credentialRepository.seed({
      id: "cred_tavily_attr",
      projectId: TEST_PROJECT_ID,
      provider: "tavily",
      encryptedSecret: encryptSecret("test_tavily", encryptionKey),
      status: "active",
    });

    app = await buildApp({
      logger: false,
      apiKeyRepository,
      projectRepository,
      credentialRepository,
      usageEventRepository: usageRepo,
      auditLogRepository: new InMemoryAuditLogRepository(),
      healthSnapshotRepository: new InMemoryHealthSnapshotRepository(),
      quotaRepository: new InMemoryQuotaRepository(),
      encryptionKey,
    });
    await app.ready();
  });

  afterEach(() => {
    restore();
  });

  test("usage event records correct provider after successful request", async () => {
    await app.inject({ method: "POST", url: "/v1/search/web", payload: { query: "attribution" }, headers: AUTH });

    const stats = await usageRepo.aggregateStats({ projectId: TEST_PROJECT_ID });
    expect(stats.totalRequests).toBe(1);
    expect(stats.successCount).toBe(1);

    const providerStats = await usageRepo.providerStats!({ projectId: TEST_PROJECT_ID });
    const braveStats = providerStats.find((p) => p.provider === "brave");
    expect(braveStats).toBeDefined();
    expect(braveStats!.requestCount).toBe(1);
  });

  test("usage event attributes to fallback provider on primary failure", async () => {
    // Override fetch: brave fails, tavily succeeds
    restore();
    restore = installMultiProviderFetchMock({ braveStatus: 503 });

    await app.inject({ method: "POST", url: "/v1/search/web", payload: { query: "fallback" }, headers: AUTH });

    const providerStats = await usageRepo.providerStats!({ projectId: TEST_PROJECT_ID });
    const tavilyStats = providerStats.find((p) => p.provider === "tavily");
    expect(tavilyStats).toBeDefined();
    expect(tavilyStats!.requestCount).toBe(1);
    expect(tavilyStats!.successCount).toBe(1);
  });
});

// AC4: canonical routes remain provider-neutral
describe("Canonical route neutrality [AC4][Task 58]", () => {
  let app: FastifyInstance;
  let restore: () => void;

  beforeEach(async () => {
    restore = installMultiProviderFetchMock();
    app = await buildMultiProviderApp();
    await app.ready();
  });

  afterEach(() => {
    restore();
  });

  test("response shape is identical regardless of provider", async () => {
    const braveRes = await app.inject({ method: "POST", url: "/v1/search/web", payload: { query: "test", provider: "brave" }, headers: AUTH });
    const tavilyRes = await app.inject({ method: "POST", url: "/v1/search/web", payload: { query: "test", provider: "tavily" }, headers: AUTH });
    const kagiRes = await app.inject({ method: "POST", url: "/v1/search/web", payload: { query: "test", provider: "kagi" }, headers: AUTH });
    const serpapiRes = await app.inject({ method: "POST", url: "/v1/search/web", payload: { query: "test", provider: "serpapi" }, headers: AUTH });

    for (const res of [braveRes, tavilyRes, kagiRes, serpapiRes]) {
      expect(res.statusCode).toBe(200);
      const body = res.json();
      // All canonical fields present
      expect(body).toHaveProperty("provider");
      expect(body).toHaveProperty("capability", "search.web");
      expect(body).toHaveProperty("items");
      expect(body).toHaveProperty("latency_ms");
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.items.length).toBeGreaterThan(0);
      // Each item has canonical fields
      const item = body.items[0];
      expect(item).toHaveProperty("title");
      expect(item).toHaveProperty("url");
      expect(item).toHaveProperty("source_type", "web");
    }
  });

  test("all four providers return correct provider attribution", async () => {
    const providers = ["brave", "tavily", "kagi", "serpapi"];
    for (const provider of providers) {
      const res = await app.inject({ method: "POST", url: "/v1/search/web", payload: { query: "test", provider }, headers: AUTH });
      expect(res.json().provider).toBe(provider);
    }
  });
});
