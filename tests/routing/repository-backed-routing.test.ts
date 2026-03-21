/**
 * Task 13 — repository-backed routing policy tests.
 *
 * Verifies that default provider, fallback ordering, and allowed providers
 * are derived from persisted project state (ProjectRepository bindings)
 * scoped to the requested capability.
 */

import { describe, it, expect } from "vitest";
import { InMemoryProjectRepository } from "../../src/infra/db/repositories/project-repository.js";
import { ProjectService } from "../../src/modules/projects/service/project-service.js";
import { RoutingService, RoutingError } from "../../src/modules/routing/service/routing-service.js";
import { createRoutingConfig } from "../../src/modules/routing/service/routing-config-factory.js";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function seedProject(opts: {
  defaultProvider: string;
  bindings: Array<{
    provider: string;
    capability: string;
    enabled: boolean;
    priority: number;
  }>;
}) {
  const repo = new InMemoryProjectRepository();
  repo.seed({
    project: { id: "proj_test", name: "Test Project", status: "active" },
    bindings: opts.bindings,
    defaultProvider: opts.defaultProvider,
  });
  return new ProjectService({ projectRepository: repo });
}

async function resolveConfig(service: ProjectService) {
  const ctx = await service.resolve("proj_test", "key_test");
  if (!ctx) throw new Error("project not found");
  return { ctx, config: createRoutingConfig(ctx) };
}

const allHealthy = { isHealthy: () => true };

/* ------------------------------------------------------------------ */
/*  ProjectContext carries raw bindings                                */
/* ------------------------------------------------------------------ */

describe("ProjectContext bindings", () => {
  it("carries raw bindings from repository", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
        { provider: "google", capability: "search.news", enabled: true, priority: 1 },
      ],
    });
    const ctx = await svc.resolve("proj_test", "k1");
    expect(ctx?.bindings).toHaveLength(2);
    expect(ctx?.defaultProvider).toBe("brave");
  });
});

/* ------------------------------------------------------------------ */
/*  RoutingConfig factory — capability-scoped                         */
/* ------------------------------------------------------------------ */

describe("createRoutingConfig (capability-scoped)", () => {
  it("defaultProvider returns project default when bound for that capability", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
      ],
    });
    const { config } = await resolveConfig(svc);
    expect(config.defaultProvider("search.web")).toBe("brave");
  });

  it("defaultProvider returns undefined when default has no binding for capability", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
        { provider: "google", capability: "search.news", enabled: true, priority: 0 },
      ],
    });
    const { config } = await resolveConfig(svc);
    // brave is default but not bound for search.news
    expect(config.defaultProvider("search.news")).toBeUndefined();
  });

  it("defaultProvider returns undefined when default binding is disabled", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: false, priority: 0 },
      ],
    });
    const { config } = await resolveConfig(svc);
    expect(config.defaultProvider("search.web")).toBeUndefined();
  });

  it("fallbackOrder returns only providers bound for the requested capability", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
        { provider: "google", capability: "search.web", enabled: true, priority: 1 },
        { provider: "bing", capability: "search.news", enabled: true, priority: 1 },
      ],
    });
    const { config } = await resolveConfig(svc);
    // search.web fallback: only google (bing is for search.news)
    expect(config.fallbackOrder("search.web")).toEqual(["google"]);
    // search.news fallback: only bing (brave is default, not bound for news)
    expect(config.fallbackOrder("search.news")).toEqual(["bing"]);
  });

  it("fallbackOrder is sorted by binding priority (ascending)", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
        { provider: "bing", capability: "search.web", enabled: true, priority: 2 },
        { provider: "google", capability: "search.web", enabled: true, priority: 1 },
      ],
    });
    const { config } = await resolveConfig(svc);
    expect(config.fallbackOrder("search.web")).toEqual(["google", "bing"]);
  });

  it("fallbackOrder excludes disabled bindings", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
        { provider: "google", capability: "search.web", enabled: false, priority: 1 },
        { provider: "bing", capability: "search.web", enabled: true, priority: 2 },
      ],
    });
    const { config } = await resolveConfig(svc);
    expect(config.fallbackOrder("search.web")).toEqual(["bing"]);
  });

  it("fallbackOrder deduplicates providers", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
        { provider: "google", capability: "search.web", enabled: true, priority: 1 },
        { provider: "google", capability: "search.web", enabled: true, priority: 2 },
      ],
    });
    const { config } = await resolveConfig(svc);
    expect(config.fallbackOrder("search.web")).toEqual(["google"]);
  });

  it("fallbackOrder is empty when only default is bound for capability", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
      ],
    });
    const { config } = await resolveConfig(svc);
    expect(config.fallbackOrder("search.web")).toEqual([]);
  });

  it("allowedProviders is scoped to the requested capability", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
        { provider: "google", capability: "search.news", enabled: true, priority: 1 },
        { provider: "bing", capability: "search.web", enabled: false, priority: 2 },
      ],
    });
    const { config } = await resolveConfig(svc);
    // search.web: only brave (bing is disabled)
    expect(config.allowedProviders("search.web")).toEqual(["brave"]);
    // search.news: only google
    expect(config.allowedProviders("search.news")).toEqual(["google"]);
  });
});

/* ------------------------------------------------------------------ */
/*  RoutingService with capability-scoped repository config            */
/* ------------------------------------------------------------------ */

describe("RoutingService with capability-scoped config", () => {
  it("selects persisted default provider for the requested capability", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
        { provider: "google", capability: "search.news", enabled: true, priority: 0 },
      ],
    });
    const { config } = await resolveConfig(svc);
    const routing = new RoutingService({ health: allHealthy, config });

    const result = routing.selectProvider("search.web");
    expect(result.providerId).toBe("brave");
    expect(result.reason).toBe("default");
  });

  it("falls back to capability-scoped fallback when default is not bound", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
        { provider: "google", capability: "search.news", enabled: true, priority: 0 },
      ],
    });
    const { config } = await resolveConfig(svc);
    const routing = new RoutingService({ health: allHealthy, config });

    // brave is not bound for search.news, so google should be selected via fallback
    const result = routing.selectProvider("search.news");
    expect(result.providerId).toBe("google");
    expect(result.reason).toBe("fallback");
  });

  it("does NOT cross-pollinate providers between capabilities", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
        { provider: "google", capability: "search.news", enabled: true, priority: 0 },
      ],
    });
    const { config } = await resolveConfig(svc);

    // search.web should NOT see google (it's only bound for search.news)
    expect(config.fallbackOrder("search.web")).toEqual([]);
    // search.news should NOT see brave in fallback (brave is default but not bound for news)
    expect(config.fallbackOrder("search.news")).toEqual(["google"]);
  });

  it("falls back in priority order within a capability", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
        { provider: "bing", capability: "search.web", enabled: true, priority: 2 },
        { provider: "google", capability: "search.web", enabled: true, priority: 1 },
      ],
    });
    const { config } = await resolveConfig(svc);
    const routing = new RoutingService({
      health: { isHealthy: (id) => id !== "brave" },
      config,
    });

    const result = routing.selectProvider("search.web");
    expect(result.providerId).toBe("google");
    expect(result.reason).toBe("fallback");
  });

  it("rejects explicit provider not bound for the requested capability", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
        { provider: "google", capability: "search.news", enabled: true, priority: 0 },
      ],
    });
    const { config } = await resolveConfig(svc);
    const routing = new RoutingService({ health: allHealthy, config });

    // google is enabled for search.news but NOT for search.web
    expect(() => routing.selectProvider("search.web", "google")).toThrow(RoutingError);
  });

  it("throws when no provider is bound for the requested capability", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
      ],
    });
    const { config } = await resolveConfig(svc);
    const routing = new RoutingService({ health: allHealthy, config });

    // search.images has no bindings at all
    expect(() => routing.selectProvider("search.images")).toThrow(RoutingError);
  });

  it("executeWithFallback follows capability-scoped fallback on retryable error", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
        { provider: "google", capability: "search.web", enabled: true, priority: 1 },
        { provider: "bing", capability: "search.news", enabled: true, priority: 0 },
      ],
    });
    const { config } = await resolveConfig(svc);
    const routing = new RoutingService({ health: allHealthy, config });

    const calls: string[] = [];
    const result = await routing.executeWithFallback(
      "search.web",
      undefined,
      async (providerId) => {
        calls.push(providerId);
        if (providerId === "brave") {
          throw Object.assign(new Error("502"), { statusCode: 502 });
        }
        return `ok-from-${providerId}`;
      },
    );

    // Should fallback to google (search.web), NOT bing (search.news)
    expect(result).toBe("ok-from-google");
    expect(calls).toEqual(["brave", "google"]);
  });

  it("single-provider capability has no fallback", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
      ],
    });
    const { config } = await resolveConfig(svc);
    const routing = new RoutingService({ health: allHealthy, config });

    const calls: string[] = [];
    await expect(
      routing.executeWithFallback(
        "search.web",
        undefined,
        async (providerId) => {
          calls.push(providerId);
          throw Object.assign(new Error("502"), { statusCode: 502 });
        },
      ),
    ).rejects.toThrow("502");

    expect(calls).toEqual(["brave"]);
  });

  it("changing default provider in repository changes routing", async () => {
    const svc1 = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
        { provider: "google", capability: "search.web", enabled: true, priority: 1 },
      ],
    });
    const { config: config1 } = await resolveConfig(svc1);
    const routing1 = new RoutingService({ health: allHealthy, config: config1 });
    expect(routing1.selectProvider("search.web").providerId).toBe("brave");

    const svc2 = seedProject({
      defaultProvider: "google",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 1 },
        { provider: "google", capability: "search.web", enabled: true, priority: 0 },
      ],
    });
    const { config: config2 } = await resolveConfig(svc2);
    const routing2 = new RoutingService({ health: allHealthy, config: config2 });
    expect(routing2.selectProvider("search.web").providerId).toBe("google");
  });
});
