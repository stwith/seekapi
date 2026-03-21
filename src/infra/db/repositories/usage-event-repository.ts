/**
 * Repository for persisting usage events. [AC3]
 *
 * The `UsageEventSink` interface is defined by the usage service.
 * This module provides an in-memory implementation for tests and
 * a repository interface for future DB-backed persistence.
 */

import type {
  UsageEvent,
  UsageEventSink,
} from "../../../modules/usage/service/usage-service.js";

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
