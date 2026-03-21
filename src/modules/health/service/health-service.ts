/**
 * HealthService — provider health probing with TTL-based caching.
 *
 * Caches the most recent health snapshot for `cacheTtlMs` so that
 * repeated requests (including unauthenticated monitors) do not
 * repeatedly hit upstream providers.
 */

import type { ProviderRegistry } from "../../../providers/core/registry.js";

export interface ProviderHealthResult {
  provider: string;
  status: "healthy" | "degraded" | "unavailable";
  latencyMs: number | null;
  checkedAt: string;
}

export interface HealthServiceDeps {
  registry: ProviderRegistry;
  /** Resolve a credential for health-checking a provider. */
  resolveHealthCredential: (provider: string) => Promise<string | undefined>;
  /** Cache TTL in milliseconds. Defaults to 30 000 (30 s). */
  cacheTtlMs?: number;
}

export class HealthService {
  private readonly deps: HealthServiceDeps;
  private readonly cacheTtlMs: number;
  private cachedSnapshot: ProviderHealthResult[] | null = null;
  private cachedAt = 0;

  constructor(deps: HealthServiceDeps) {
    this.deps = deps;
    this.cacheTtlMs = deps.cacheTtlMs ?? 30_000;
  }

  /** Return the latest provider health snapshot, probing if stale. */
  async getProviderHealth(): Promise<ProviderHealthResult[]> {
    if (this.cachedSnapshot && Date.now() - this.cachedAt < this.cacheTtlMs) {
      return this.cachedSnapshot;
    }

    const adapters = this.deps.registry.list();
    const results = await Promise.all(
      adapters.map(async (adapter) => {
        try {
          const credential = await this.deps.resolveHealthCredential(adapter.id);
          const health = await adapter.healthCheck({ credential });
          return {
            provider: adapter.id,
            status: health.status,
            latencyMs: health.latencyMs ?? null,
            checkedAt: health.checkedAt.toISOString(),
          } satisfies ProviderHealthResult;
        } catch {
          return {
            provider: adapter.id,
            status: "unavailable" as const,
            latencyMs: null,
            checkedAt: new Date().toISOString(),
          };
        }
      }),
    );

    this.cachedSnapshot = results;
    this.cachedAt = Date.now();
    return results;
  }
}
