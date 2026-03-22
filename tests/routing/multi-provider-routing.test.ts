import { describe, it, expect } from "vitest";
import {
  RoutingService,
  RoutingError,
  type ProviderHealth,
} from "../../src/modules/routing/service/routing-service.js";
import { ProviderError } from "../../src/providers/core/errors.js";
import { ProviderRegistry } from "../../src/providers/core/registry.js";
import { BraveAdapter } from "../../src/providers/brave/adapter.js";
import { TavilyAdapter } from "../../src/providers/tavily/adapter.js";
import { createRoutingConfig } from "../../src/modules/routing/service/routing-config-factory.js";
import type { ProjectContext } from "../../src/modules/projects/service/project-service.js";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function makeHealth(
  healthy: Record<string, boolean> = {},
): ProviderHealth {
  return {
    isHealthy: (id: string) => healthy[id] ?? true,
  };
}

function makeProjectContext(overrides?: Partial<ProjectContext>): ProjectContext {
  return {
    projectId: "proj_test",
    defaultProvider: "brave",
    bindings: [
      { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
      { provider: "tavily", capability: "search.web", enabled: true, priority: 1 },
      { provider: "brave", capability: "search.news", enabled: true, priority: 0 },
      { provider: "brave", capability: "search.images", enabled: true, priority: 0 },
    ],
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Registry: 2-provider                                              */
/* ------------------------------------------------------------------ */

// AC2: multi-provider registry validation
describe("Two-provider registry", () => {
  it("registers both Brave and Tavily without conflict", () => {
    const registry = new ProviderRegistry();
    registry.register(new BraveAdapter());
    registry.register(new TavilyAdapter());

    expect(registry.listIds()).toContain("brave");
    expect(registry.listIds()).toContain("tavily");
    expect(registry.list()).toHaveLength(2);
  });

  it("byCapability returns both for search.web", () => {
    const registry = new ProviderRegistry();
    registry.register(new BraveAdapter());
    registry.register(new TavilyAdapter());

    const webProviders = registry.byCapability("search.web");
    expect(webProviders.map((a) => a.id)).toContain("brave");
    expect(webProviders.map((a) => a.id)).toContain("tavily");
  });

  it("byCapability returns only Brave for search.news", () => {
    const registry = new ProviderRegistry();
    registry.register(new BraveAdapter());
    registry.register(new TavilyAdapter());

    const newsProviders = registry.byCapability("search.news");
    expect(newsProviders.map((a) => a.id)).toEqual(["brave"]);
  });

  it("byCapability returns only Brave for search.images", () => {
    const registry = new ProviderRegistry();
    registry.register(new BraveAdapter());
    registry.register(new TavilyAdapter());

    const imageProviders = registry.byCapability("search.images");
    expect(imageProviders.map((a) => a.id)).toEqual(["brave"]);
  });
});

/* ------------------------------------------------------------------ */
/*  Routing: project binding → default provider selection              */
/* ------------------------------------------------------------------ */

// AC2: routing respects project bindings
describe("Two-provider routing with project bindings", () => {
  it("selects default provider from project binding", () => {
    const ctx = makeProjectContext();
    const config = createRoutingConfig(ctx);
    const service = new RoutingService({ health: makeHealth(), config });

    const result = service.selectProvider("search.web");
    expect(result.providerId).toBe("brave");
    expect(result.reason).toBe("default");
  });

  it("selects tavily as default when project is configured for tavily", () => {
    const ctx = makeProjectContext({
      defaultProvider: "tavily",
      bindings: [
        { provider: "tavily", capability: "search.web", enabled: true, priority: 0 },
        { provider: "brave", capability: "search.web", enabled: true, priority: 1 },
      ],
    });
    const config = createRoutingConfig(ctx);
    const service = new RoutingService({ health: makeHealth(), config });

    const result = service.selectProvider("search.web");
    expect(result.providerId).toBe("tavily");
    expect(result.reason).toBe("default");
  });

  it("explicit provider: tavily routes to tavily", () => {
    const ctx = makeProjectContext();
    const config = createRoutingConfig(ctx);
    const service = new RoutingService({ health: makeHealth(), config });

    const result = service.selectProvider("search.web", "tavily");
    expect(result.providerId).toBe("tavily");
    expect(result.reason).toBe("explicit");
  });
});

/* ------------------------------------------------------------------ */
/*  Fallback: Brave → Tavily on retryable error                       */
/* ------------------------------------------------------------------ */

// AC2: fallback across providers
describe("Two-provider fallback", () => {
  it("falls back Brave → Tavily on retryable error", async () => {
    const ctx = makeProjectContext();
    const config = createRoutingConfig(ctx);
    const service = new RoutingService({ health: makeHealth(), config });

    const callLog: string[] = [];

    const result = await service.executeWithFallback(
      "search.web",
      undefined,
      async (providerId) => {
        callLog.push(providerId);
        if (providerId === "brave") {
          throw new ProviderError({
            message: "Brave 503",
            category: "upstream_5xx",
            provider: "brave",
            statusCode: 503,
          });
        }
        return { provider: providerId, success: true };
      },
    );

    expect(callLog).toEqual(["brave", "tavily"]);
    expect(result).toEqual({ provider: "tavily", success: true });
  });

  it("falls back Tavily → Brave when Tavily is default and fails", async () => {
    const ctx = makeProjectContext({
      defaultProvider: "tavily",
      bindings: [
        { provider: "tavily", capability: "search.web", enabled: true, priority: 0 },
        { provider: "brave", capability: "search.web", enabled: true, priority: 1 },
      ],
    });
    const config = createRoutingConfig(ctx);
    const service = new RoutingService({ health: makeHealth(), config });

    const callLog: string[] = [];

    const result = await service.executeWithFallback(
      "search.web",
      undefined,
      async (providerId) => {
        callLog.push(providerId);
        if (providerId === "tavily") {
          throw new ProviderError({
            message: "Tavily 503",
            category: "upstream_5xx",
            provider: "tavily",
            statusCode: 503,
          });
        }
        return { provider: providerId, success: true };
      },
    );

    expect(callLog).toEqual(["tavily", "brave"]);
    expect(result).toEqual({ provider: "brave", success: true });
  });

  it("non-retryable error (bad_credential) fails fast without fallback", async () => {
    const ctx = makeProjectContext();
    const config = createRoutingConfig(ctx);
    const service = new RoutingService({ health: makeHealth(), config });

    const callLog: string[] = [];

    await expect(
      service.executeWithFallback(
        "search.web",
        undefined,
        async (providerId) => {
          callLog.push(providerId);
          throw new ProviderError({
            message: "Bad credential",
            category: "bad_credential",
            provider: providerId,
            statusCode: 401,
          });
        },
      ),
    ).rejects.toThrow(ProviderError);

    // Should NOT try tavily since bad_credential is non-retryable
    expect(callLog).toEqual(["brave"]);
  });
});

/* ------------------------------------------------------------------ */
/*  Health-aware exclusion                                            */
/* ------------------------------------------------------------------ */

// AC2: health-aware provider exclusion
describe("Two-provider health-aware routing", () => {
  it("skips unhealthy default and uses healthy fallback", () => {
    const ctx = makeProjectContext();
    const config = createRoutingConfig(ctx);
    const service = new RoutingService({
      health: makeHealth({ brave: false }),
      config,
    });

    const result = service.selectProvider("search.web");
    expect(result.providerId).toBe("tavily");
    expect(result.reason).toBe("fallback");
  });

  it("throws when all providers for capability are unhealthy", () => {
    const ctx = makeProjectContext();
    const config = createRoutingConfig(ctx);
    const service = new RoutingService({
      health: makeHealth({ brave: false, tavily: false }),
      config,
    });

    expect(() => service.selectProvider("search.web")).toThrow(RoutingError);
  });

  it("unhealthy provider is skipped in executeWithFallback", async () => {
    const ctx = makeProjectContext();
    const config = createRoutingConfig(ctx);
    const service = new RoutingService({
      health: makeHealth({ brave: false }),
      config,
    });

    const callLog: string[] = [];
    const result = await service.executeWithFallback(
      "search.web",
      undefined,
      async (providerId) => {
        callLog.push(providerId);
        return { provider: providerId };
      },
    );

    // Brave should be skipped entirely since it's unhealthy
    expect(callLog).toEqual(["tavily"]);
    expect(result).toEqual({ provider: "tavily" });
  });
});

/* ------------------------------------------------------------------ */
/*  Usage event provider attribution                                  */
/* ------------------------------------------------------------------ */

// AC3: usage events record correct provider
describe("Two-provider usage attribution", () => {
  it("executeWithFallback returns the provider that actually succeeded", async () => {
    const ctx = makeProjectContext();
    const config = createRoutingConfig(ctx);
    const service = new RoutingService({ health: makeHealth(), config });

    // Brave fails, Tavily succeeds — usage should attribute to tavily
    const result = await service.executeWithFallback(
      "search.web",
      undefined,
      async (providerId) => {
        if (providerId === "brave") {
          throw new ProviderError({
            message: "timeout",
            category: "timeout",
            provider: "brave",
          });
        }
        return { provider: providerId, latencyMs: 100 };
      },
    );

    expect(result.provider).toBe("tavily");
  });

  it("explicit provider request attributes to the explicit provider", async () => {
    const ctx = makeProjectContext();
    const config = createRoutingConfig(ctx);
    const service = new RoutingService({ health: makeHealth(), config });

    const result = await service.executeWithFallback(
      "search.web",
      "tavily",
      async (providerId) => {
        return { provider: providerId, latencyMs: 50 };
      },
    );

    expect(result.provider).toBe("tavily");
  });
});
