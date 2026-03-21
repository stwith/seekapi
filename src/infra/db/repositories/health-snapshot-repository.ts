/**
 * Repository for persisting provider health snapshots. [AC3]
 *
 * Each probe cycle writes a batch of snapshots so that health
 * history is available for diagnostics and trend analysis.
 */

import type { ProviderHealthResult } from "../../../modules/health/service/health-service.js";

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
