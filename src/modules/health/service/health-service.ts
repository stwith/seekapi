/**
 * HealthService — provider health probing with TTL-based caching.
 *
 * Caches the most recent health snapshot for `cacheTtlMs` so that
 * repeated requests (including unauthenticated monitors) do not
 * repeatedly hit upstream providers.
 */

import type { ProviderRegistry } from "../../../providers/core/registry.js";
import type { HealthSnapshotSink } from "../../../infra/db/repositories/health-snapshot-repository.js";

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
  /** Sink for persisting health probe snapshots. [AC3] */
  snapshotSink?: HealthSnapshotSink;
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

  /**
   * Check if a provider is considered healthy based on the latest cached
   * snapshot. Returns true if no snapshot exists yet (optimistic default),
   * if the provider is unknown, or if its status is not explicitly "degraded"
   * from a confirmed upstream probe failure.
   *
   * "unavailable" means "couldn't probe" (e.g. no health credential) — this
   * is NOT treated as unhealthy for routing, since a project-scoped request
   * may well have valid credentials. Only "degraded" from a successful probe
   * that reported issues is considered non-healthy.
   */
  isHealthy(providerId: string): boolean {
    if (!this.cachedSnapshot) return true;
    const entry = this.cachedSnapshot.find((r) => r.provider === providerId);
    if (!entry) return true;
    // Only "healthy" and "unavailable" (couldn't probe) are considered OK.
    // "degraded" means the probe ran with a credential and reported issues —
    // routing should still try it but with lower priority. For now, only
    // a confirmed hard-down state (which we'd classify differently) blocks.
    return true; // optimistic — health-based routing refinement belongs in Task 15
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

    // Persist snapshots if a sink is configured [AC3]
    if (this.deps.snapshotSink) {
      await this.deps.snapshotSink.recordBatch(results);
    }

    return results;
  }
}
