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

/** Filters for querying usage events. [Phase 3.5 AC6] */
export interface UsageQueryFilters {
  projectId?: string;
  apiKeyId?: string;
  capability?: string;
  success?: boolean;
  from?: string; // ISO date
  to?: string;   // ISO date
}

/** Paginated query result. */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Aggregated stats result. */
export interface UsageStats {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  avgLatencyMs: number;
}

/** Time series data point. */
export interface TimeSeriesPoint {
  bucket: string; // ISO timestamp for the bucket start
  count: number;
  successCount: number;
  failureCount: number;
}

/** Capability breakdown entry. */
export interface CapabilityBreakdown {
  capability: string;
  count: number;
}

/** Per-key stats entry. */
export interface KeyUsageStats {
  apiKeyId: string;
  requestCount: number;
  successCount: number;
  failureCount: number;
  avgLatencyMs: number;
}

export interface UsageEventRepository extends UsageEventSink {
  /** Return all persisted events (test helper). */
  findAll(): Promise<UsageEvent[]>;
  /** Query usage events with filtering and pagination. [Phase 3.5 AC6] */
  query?(filters: UsageQueryFilters, page: number, pageSize: number): Promise<PaginatedResult<UsageEvent>>;
  /** Aggregate stats for dashboard. [Phase 3.5 AC6] */
  aggregateStats?(filters: UsageQueryFilters): Promise<UsageStats>;
  /** Time series for charts. [Phase 3.5 AC6] */
  timeSeries?(filters: UsageQueryFilters, granularity: "hour" | "day"): Promise<TimeSeriesPoint[]>;
  /** Capability breakdown. [Phase 3.5 AC6] */
  topCapabilities?(filters: UsageQueryFilters): Promise<CapabilityBreakdown[]>;
  /** Per-key usage stats. [Phase 3.5 AC6] */
  perKeyStats?(projectId: string): Promise<KeyUsageStats[]>;
}

/**
 * In-memory implementation for tests and local development.
 */
export class InMemoryUsageEventRepository implements UsageEventRepository {
  private readonly events: UsageEvent[] = [];
  private readonly timestamps: Map<string, Date> = new Map();

  async record(event: UsageEvent): Promise<void> {
    this.events.push({ ...event });
    this.timestamps.set(event.requestId, new Date());
  }

  async findAll(): Promise<UsageEvent[]> {
    return [...this.events];
  }

  private applyFilters(filters: UsageQueryFilters): UsageEvent[] {
    return this.events.filter((e) => {
      if (filters.projectId && e.projectId !== filters.projectId) return false;
      if (filters.apiKeyId && e.apiKeyId !== filters.apiKeyId) return false;
      if (filters.capability && e.capability !== filters.capability) return false;
      if (filters.success !== undefined && e.success !== filters.success) return false;
      if (filters.from) {
        const ts = this.timestamps.get(e.requestId);
        if (ts && ts < new Date(filters.from)) return false;
      }
      if (filters.to) {
        const ts = this.timestamps.get(e.requestId);
        if (ts && ts > new Date(filters.to)) return false;
      }
      return true;
    });
  }

  async query(filters: UsageQueryFilters, page: number, pageSize: number): Promise<PaginatedResult<UsageEvent>> {
    const filtered = this.applyFilters(filters);
    const start = (page - 1) * pageSize;
    return {
      items: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
    };
  }

  async aggregateStats(filters: UsageQueryFilters): Promise<UsageStats> {
    const filtered = this.applyFilters(filters);
    const totalRequests = filtered.length;
    const successCount = filtered.filter((e) => e.success).length;
    const failureCount = totalRequests - successCount;
    const avgLatencyMs = totalRequests > 0
      ? filtered.reduce((sum, e) => sum + e.latencyMs, 0) / totalRequests
      : 0;
    return { totalRequests, successCount, failureCount, avgLatencyMs };
  }

  async timeSeries(filters: UsageQueryFilters, granularity: "hour" | "day"): Promise<TimeSeriesPoint[]> {
    const filtered = this.applyFilters(filters);
    const buckets = new Map<string, TimeSeriesPoint>();

    for (const event of filtered) {
      const ts = this.timestamps.get(event.requestId) ?? new Date();
      const d = new Date(ts);
      if (granularity === "hour") {
        d.setMinutes(0, 0, 0);
      } else {
        d.setHours(0, 0, 0, 0);
      }
      const key = d.toISOString();
      const existing = buckets.get(key) ?? { bucket: key, count: 0, successCount: 0, failureCount: 0 };
      existing.count++;
      if (event.success) existing.successCount++;
      else existing.failureCount++;
      buckets.set(key, existing);
    }

    return [...buckets.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
  }

  async topCapabilities(filters: UsageQueryFilters): Promise<CapabilityBreakdown[]> {
    const filtered = this.applyFilters(filters);
    const counts = new Map<string, number>();
    for (const event of filtered) {
      counts.set(event.capability, (counts.get(event.capability) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([capability, count]) => ({ capability, count }))
      .sort((a, b) => b.count - a.count);
  }

  async perKeyStats(projectId: string): Promise<KeyUsageStats[]> {
    const projectEvents = this.events.filter((e) => e.projectId === projectId);
    const byKey = new Map<string, UsageEvent[]>();
    for (const event of projectEvents) {
      const list = byKey.get(event.apiKeyId) ?? [];
      list.push(event);
      byKey.set(event.apiKeyId, list);
    }
    return [...byKey.entries()].map(([apiKeyId, events]) => ({
      apiKeyId,
      requestCount: events.length,
      successCount: events.filter((e) => e.success).length,
      failureCount: events.filter((e) => !e.success).length,
      avgLatencyMs: events.reduce((sum, e) => sum + e.latencyMs, 0) / events.length,
    }));
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

  private mapRow(r: typeof usageEvents.$inferSelect): UsageEvent {
    return {
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
    };
  }

  async query(filters: UsageQueryFilters, page: number, pageSize: number): Promise<PaginatedResult<UsageEvent>> {
    const { and, eq, gte, lte, count } = await import("drizzle-orm");
    const conditions = [];
    if (filters.projectId) conditions.push(eq(usageEvents.projectId, filters.projectId));
    if (filters.apiKeyId) conditions.push(eq(usageEvents.apiKeyId, filters.apiKeyId));
    if (filters.capability) conditions.push(eq(usageEvents.capability, filters.capability));
    if (filters.success !== undefined) conditions.push(eq(usageEvents.success, filters.success));
    if (filters.from) conditions.push(gte(usageEvents.createdAt, new Date(filters.from)));
    if (filters.to) conditions.push(lte(usageEvents.createdAt, new Date(filters.to)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await this.db
      .select({ total: count() })
      .from(usageEvents)
      .where(where);

    const rows = await this.db
      .select()
      .from(usageEvents)
      .where(where)
      .orderBy(usageEvents.createdAt)
      .offset((page - 1) * pageSize)
      .limit(pageSize);

    return {
      items: rows.map((r) => this.mapRow(r)),
      total: countResult?.total ?? 0,
      page,
      pageSize,
    };
  }

  async aggregateStats(filters: UsageQueryFilters): Promise<UsageStats> {
    const { and, eq, gte, lte, count, avg, sql } = await import("drizzle-orm");
    const conditions = [];
    if (filters.projectId) conditions.push(eq(usageEvents.projectId, filters.projectId));
    if (filters.apiKeyId) conditions.push(eq(usageEvents.apiKeyId, filters.apiKeyId));
    if (filters.capability) conditions.push(eq(usageEvents.capability, filters.capability));
    if (filters.success !== undefined) conditions.push(eq(usageEvents.success, filters.success));
    if (filters.from) conditions.push(gte(usageEvents.createdAt, new Date(filters.from)));
    if (filters.to) conditions.push(lte(usageEvents.createdAt, new Date(filters.to)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [result] = await this.db
      .select({
        totalRequests: count(),
        successCount: sql<number>`count(*) filter (where ${usageEvents.success} = true)`,
        failureCount: sql<number>`count(*) filter (where ${usageEvents.success} = false)`,
        avgLatencyMs: avg(usageEvents.latencyMs),
      })
      .from(usageEvents)
      .where(where);

    return {
      totalRequests: result?.totalRequests ?? 0,
      successCount: Number(result?.successCount ?? 0),
      failureCount: Number(result?.failureCount ?? 0),
      avgLatencyMs: Number(result?.avgLatencyMs ?? 0),
    };
  }

  async timeSeries(filters: UsageQueryFilters, granularity: "hour" | "day"): Promise<TimeSeriesPoint[]> {
    const { and, eq, gte, lte, sql, count } = await import("drizzle-orm");
    const conditions = [];
    if (filters.projectId) conditions.push(eq(usageEvents.projectId, filters.projectId));
    if (filters.from) conditions.push(gte(usageEvents.createdAt, new Date(filters.from)));
    if (filters.to) conditions.push(lte(usageEvents.createdAt, new Date(filters.to)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const trunc = granularity === "hour" ? "hour" : "day";

    const rows = await this.db
      .select({
        bucket: sql<string>`date_trunc(${trunc}, ${usageEvents.createdAt})::text`,
        count: count(),
        successCount: sql<number>`count(*) filter (where ${usageEvents.success} = true)`,
        failureCount: sql<number>`count(*) filter (where ${usageEvents.success} = false)`,
      })
      .from(usageEvents)
      .where(where)
      .groupBy(sql`date_trunc(${trunc}, ${usageEvents.createdAt})`)
      .orderBy(sql`date_trunc(${trunc}, ${usageEvents.createdAt})`);

    return rows.map((r) => ({
      bucket: r.bucket,
      count: r.count,
      successCount: Number(r.successCount),
      failureCount: Number(r.failureCount),
    }));
  }

  async topCapabilities(filters: UsageQueryFilters): Promise<CapabilityBreakdown[]> {
    const { and, eq, gte, lte, count, desc } = await import("drizzle-orm");
    const conditions = [];
    if (filters.projectId) conditions.push(eq(usageEvents.projectId, filters.projectId));
    if (filters.from) conditions.push(gte(usageEvents.createdAt, new Date(filters.from)));
    if (filters.to) conditions.push(lte(usageEvents.createdAt, new Date(filters.to)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await this.db
      .select({
        capability: usageEvents.capability,
        count: count(),
      })
      .from(usageEvents)
      .where(where)
      .groupBy(usageEvents.capability)
      .orderBy(desc(count()));

    return rows.map((r) => ({ capability: r.capability, count: r.count }));
  }

  async perKeyStats(projectId: string): Promise<KeyUsageStats[]> {
    const { eq, count, avg, sql } = await import("drizzle-orm");

    const rows = await this.db
      .select({
        apiKeyId: usageEvents.apiKeyId,
        requestCount: count(),
        successCount: sql<number>`count(*) filter (where ${usageEvents.success} = true)`,
        failureCount: sql<number>`count(*) filter (where ${usageEvents.success} = false)`,
        avgLatencyMs: avg(usageEvents.latencyMs),
      })
      .from(usageEvents)
      .where(eq(usageEvents.projectId, projectId))
      .groupBy(usageEvents.apiKeyId);

    return rows.map((r) => ({
      apiKeyId: r.apiKeyId,
      requestCount: r.requestCount,
      successCount: Number(r.successCount),
      failureCount: Number(r.failureCount),
      avgLatencyMs: Number(r.avgLatencyMs ?? 0),
    }));
  }
}
