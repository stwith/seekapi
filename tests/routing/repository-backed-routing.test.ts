/**
 * Task 13 — repository-backed routing policy tests.
 *
 * Verifies that default provider, fallback ordering, and allowed providers
 * are derived from persisted project state (ProjectRepository bindings)
 * rather than hardcoded assumptions.
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
/*  ProjectContext derivation                                          */
/* ------------------------------------------------------------------ */

describe("ProjectContext routing fields", () => {
  it("derives defaultProvider from repository", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
      ],
    });
    const ctx = await svc.resolve("proj_test", "k1");
    expect(ctx?.defaultProvider).toBe("brave");
  });

  it("derives allowedProviders from enabled bindings", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
        { provider: "google", capability: "search.web", enabled: true, priority: 1 },
        { provider: "bing", capability: "search.web", enabled: false, priority: 2 },
      ],
    });
    const ctx = await svc.resolve("proj_test", "k1");
    expect(ctx?.allowedProviders).toEqual(["brave", "google"]);
  });

  it("derives fallbackProviders excluding the default, sorted by priority", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
        { provider: "bing", capability: "search.web", enabled: true, priority: 2 },
        { provider: "google", capability: "search.web", enabled: true, priority: 1 },
      ],
    });
    const ctx = await svc.resolve("proj_test", "k1");
    // google (priority 1) before bing (priority 2), brave excluded
    expect(ctx?.fallbackProviders).toEqual(["google", "bing"]);
  });

  it("excludes disabled bindings from fallbackProviders", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
        { provider: "google", capability: "search.web", enabled: false, priority: 1 },
        { provider: "bing", capability: "search.web", enabled: true, priority: 2 },
      ],
    });
    const ctx = await svc.resolve("proj_test", "k1");
    expect(ctx?.fallbackProviders).toEqual(["bing"]);
  });

  it("deduplicates fallbackProviders across capabilities", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
        { provider: "google", capability: "search.web", enabled: true, priority: 1 },
        { provider: "google", capability: "search.news", enabled: true, priority: 1 },
      ],
    });
    const ctx = await svc.resolve("proj_test", "k1");
    expect(ctx?.fallbackProviders).toEqual(["google"]);
  });

  it("returns empty fallbackProviders when only default is bound", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
      ],
    });
    const ctx = await svc.resolve("proj_test", "k1");
    expect(ctx?.fallbackProviders).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/*  RoutingConfig factory                                             */
/* ------------------------------------------------------------------ */

describe("createRoutingConfig", () => {
  it("defaultProvider returns the project default", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
      ],
    });
    const { config } = await resolveConfig(svc);
    expect(config.defaultProvider("search.web")).toBe("brave");
  });

  it("fallbackOrder returns sorted fallback providers", async () => {
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

  it("allowedProviders returns all enabled providers", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
        { provider: "google", capability: "search.web", enabled: true, priority: 1 },
      ],
    });
    const { config } = await resolveConfig(svc);
    expect(config.allowedProviders()).toEqual(["brave", "google"]);
  });
});

/* ------------------------------------------------------------------ */
/*  RoutingService with repository-backed config                      */
/* ------------------------------------------------------------------ */

describe("RoutingService with repository-backed config", () => {
  it("selects persisted default provider", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
        { provider: "google", capability: "search.web", enabled: true, priority: 1 },
      ],
    });
    const { config } = await resolveConfig(svc);
    const routing = new RoutingService({ health: allHealthy, config });

    const result = routing.selectProvider("search.web");
    expect(result.providerId).toBe("brave");
    expect(result.reason).toBe("default");
  });

  it("falls back in persisted priority order when default is unhealthy", async () => {
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
    // google (priority 1) should be tried before bing (priority 2)
    expect(result.providerId).toBe("google");
    expect(result.reason).toBe("fallback");
  });

  it("respects binding priority for fallback ordering", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
        { provider: "bing", capability: "search.web", enabled: true, priority: 1 },
        { provider: "google", capability: "search.web", enabled: true, priority: 2 },
      ],
    });
    const { config } = await resolveConfig(svc);
    const routing = new RoutingService({
      health: { isHealthy: (id) => id !== "brave" },
      config,
    });

    const result = routing.selectProvider("search.web");
    // bing has lower priority number (1) → tried first
    expect(result.providerId).toBe("bing");
  });

  it("throws when no healthy provider is available from repo config", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
      ],
    });
    const { config } = await resolveConfig(svc);
    const routing = new RoutingService({
      health: { isHealthy: () => false },
      config,
    });

    expect(() => routing.selectProvider("search.web")).toThrow(RoutingError);
  });

  it("executeWithFallback follows persisted fallback order on retryable error", async () => {
    const svc = seedProject({
      defaultProvider: "brave",
      bindings: [
        { provider: "brave", capability: "search.web", enabled: true, priority: 0 },
        { provider: "google", capability: "search.web", enabled: true, priority: 1 },
        { provider: "bing", capability: "search.web", enabled: true, priority: 2 },
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

    expect(result).toBe("ok-from-google");
    expect(calls).toEqual(["brave", "google"]);
  });

  it("single-provider project has no fallback", async () => {
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
    // First project: default is brave
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

    // Second project: default is google
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
