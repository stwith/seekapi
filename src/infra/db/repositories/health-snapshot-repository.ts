/**
 * Repository for persisting provider health snapshots. [AC3]
 *
 * Each probe cycle writes a batch of snapshots so that health
 * history is available for diagnostics and trend analysis.
 * Provides both an in-memory implementation (tests) and a
 * Drizzle-backed implementation (production).
 */

import type { ProviderHealthResult } from "../../../modules/health/service/health-service.js";
import type { DbClient } from "../client.js";
import { providerHealthSnapshots } from "../schema/provider-health-snapshots.js";

export interface HealthSnapshotSink {
  /** Persist a batch of health probe results. */
  recordBatch(results: ProviderHealthResult[]): Promise<void>;
}

export interface HealthSnapshotRepository extends HealthSnapshotSink {
  /** Return all persisted snapshots (test helper). */
  findAll(): Promise<ProviderHealthResult[]>;
}

/**
 * In-memory implementation for tests and local development.
 */
export class InMemoryHealthSnapshotRepository
  implements HealthSnapshotRepository
{
  private readonly snapshots: ProviderHealthResult[] = [];

  async recordBatch(results: ProviderHealthResult[]): Promise<void> {
    this.snapshots.push(...results.map((r) => ({ ...r })));
  }

  async findAll(): Promise<ProviderHealthResult[]> {
    return [...this.snapshots];
  }
}

/**
 * Drizzle-backed implementation for production persistence. [AC3]
 */
export class DrizzleHealthSnapshotRepository
  implements HealthSnapshotRepository
{
  constructor(private readonly db: DbClient) {}

  async recordBatch(results: ProviderHealthResult[]): Promise<void> {
    if (results.length === 0) return;
    await this.db.insert(providerHealthSnapshots).values(
      results.map((r) => ({
        provider: r.provider,
        capability: "",  // health probes are provider-level, not capability-scoped
        status: r.status,
        latencyMs: r.latencyMs,
        checkedAt: new Date(r.checkedAt),
      })),
    );
  }

  async findAll(): Promise<ProviderHealthResult[]> {
    const rows = await this.db.select().from(providerHealthSnapshots);
    return rows.map((r) => ({
      provider: r.provider,
      status: r.status as ProviderHealthResult["status"],
      latencyMs: r.latencyMs,
      checkedAt: r.checkedAt.toISOString(),
    }));
  }
}
