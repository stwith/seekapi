import { describe, it, expect, vi } from "vitest";
import { SearchService, type SearchServiceDeps } from "../../src/modules/capabilities/service/search-service.js";
import { CredentialExhaustedError } from "../../src/modules/credentials/service/credential-service.js";
import type { ProviderAdapter, Capability } from "../../src/providers/core/types.js";
import { ProviderRegistry } from "../../src/providers/core/registry.js";
import type { ProjectContext } from "../../src/modules/projects/service/project-service.js";

const KEY_HEX = "a".repeat(64);

function makeStubAdapter(id: string): ProviderAdapter {
  return {
    id,
    supportedCapabilities: () => ["search.web" as Capability],
    validateCredential: vi.fn(),
    execute: vi.fn(async (_req, ctx) => ({
      requestId: ctx.requestId,
      provider: id,
      capability: "search.web" as Capability,
      latencyMs: 42,
      items: [{ title: "Result", url: "https://example.com", snippet: "test", sourceType: "web" }],
      citations: [],
      extensions: {},
      raw: null,
    })),
    healthCheck: vi.fn(),
  };
}

function makeProjectContext(overrides: Partial<ProjectContext> = {}): ProjectContext {
  return {
    projectId: "proj_001",
    apiKeyId: "key_001",
    defaultProvider: "brave",
    bindings: [
      { provider: "brave", capability: "search.web", enabled: true, priority: 1 },
    ],
    ...overrides,
  };
}

describe("AC6 — Runtime exclusion of hard-exhausted credentials", () => {
  it("search succeeds when resolveWithCapacity returns a valid credential", async () => {
    const registry = new ProviderRegistry();
    const adapter = makeStubAdapter("brave");
    registry.register(adapter);

    const deps: SearchServiceDeps = {
      registry,
      resolveCredential: async () => ({
        credentialId: "cred_001",
        secret: "test-key",
      }),
      health: { isHealthy: () => true },
    };

    const svc = new SearchService(deps);
    const result = await svc.execute(
      "search.web",
      { query: "test" },
      "req_001",
      makeProjectContext(),
    );

    expect(result.response.provider).toBe("brave");
    expect(result.credentialId).toBe("cred_001");
  });

  it("search fails with exhausted error when all credentials are exhausted (explicit provider)", async () => {
    const registry = new ProviderRegistry();
    const adapter = makeStubAdapter("brave");
    registry.register(adapter);

    const deps: SearchServiceDeps = {
      registry,
      resolveCredential: async (_pid, prov) => {
        throw new CredentialExhaustedError("proj_001", prov);
      },
      health: { isHealthy: () => true },
    };

    const svc = new SearchService(deps);
    // Explicit provider = no fallback, error propagates
    await expect(
      svc.execute(
        "search.web",
        { query: "test", provider: "brave" },
        "req_002",
        makeProjectContext(),
      ),
    ).rejects.toThrow(/exhausted/i);
  });

  it("fallback skips provider with exhausted credentials and uses next provider", async () => {
    const registry = new ProviderRegistry();
    const braveAdapter = makeStubAdapter("brave");
    const tavilyAdapter = makeStubAdapter("tavily");
    registry.register(braveAdapter);
    registry.register(tavilyAdapter);

    let callCount = 0;
    const deps: SearchServiceDeps = {
      registry,
      resolveCredential: async (_projectId, provider) => {
        callCount++;
        if (provider === "brave") {
          throw new CredentialExhaustedError("proj_001", provider);
        }
        return { credentialId: "cred_tavily", secret: "tavily-key" };
      },
      health: { isHealthy: () => true },
    };

    const ctx = makeProjectContext({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 1 },
        { provider: "tavily", capability: "search.web", enabled: true, priority: 2 },
      ],
    });

    const svc = new SearchService(deps);
    const result = await svc.execute(
      "search.web",
      { query: "test" },
      "req_003",
      ctx,
    );

    expect(result.response.provider).toBe("tavily");
    expect(result.credentialId).toBe("cred_tavily");
  });
});
