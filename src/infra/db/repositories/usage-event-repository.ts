/**
 * Repository for persisting usage events. [AC3]
 *
 * The `UsageEventSink` interface is defined by the usage service.
 * Provides both an in-memory implementation (tests) and a
 * Drizzle-backed implementation (production).
 */

import type {
  UsageEvent,
  UsageEventSink,
} from "../../../modules/usage/service/usage-service.js";
import type { DbClient } from "../client.js";
import { usageEvents } from "../schema/usage-events.js";

export interface UsageEventRepository extends UsageEventSink {
  /** Return all persisted events (test helper). */
  findAll(): Promise<UsageEvent[]>;
}

/**
 * In-memory implementation for tests and local development.
 */
export class InMemoryUsageEventRepository implements UsageEventRepository {
  private readonly events: UsageEvent[] = [];

  async record(event: UsageEvent): Promise<void> {
    this.events.push({ ...event });
  }

  async findAll(): Promise<UsageEvent[]> {
    return [...this.events];
  }
}

/**
 * Drizzle-backed implementation for production persistence. [AC3]
 */
export class DrizzleUsageEventRepository implements UsageEventRepository {
  constructor(private readonly db: DbClient) {}

  async record(event: UsageEvent): Promise<void> {
    await this.db.insert(usageEvents).values({
      requestId: event.requestId,
      projectId: event.projectId,
      apiKeyId: event.apiKeyId,
      provider: event.provider,
      capability: event.capability,
      statusCode: event.statusCode,
      success: event.success,
      latencyMs: event.latencyMs,
      resultCount: event.resultCount,
      fallbackCount: event.fallbackCount,
      estimatedCost: event.estimatedCost ?? null,
    });
  }

  async findAll(): Promise<UsageEvent[]> {
    const rows = await this.db.select().from(usageEvents);
    return rows.map((r) => ({
      requestId: r.requestId,
      projectId: r.projectId,
      apiKeyId: r.apiKeyId,
      provider: r.provider,
      capability: r.capability as UsageEvent["capability"],
      statusCode: r.statusCode,
      success: r.success,
      latencyMs: r.latencyMs,
      resultCount: r.resultCount,
      fallbackCount: r.fallbackCount,
      estimatedCost: r.estimatedCost ?? undefined,
    }));
  }
}
