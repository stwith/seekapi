/**
 * Repository for persisting audit log entries. [AC3]
 *
 * The `AuditLogSink` interface is defined by the audit service.
 * Provides both an in-memory implementation (tests) and a
 * Drizzle-backed implementation (production).
 */

import type {
  AuditEntry,
  AuditLogSink,
} from "../../../modules/audit/service/audit-service.js";
import type { DbClient } from "../client.js";
import { auditLogs } from "../schema/audit-logs.js";
import type { PaginatedResult } from "./usage-event-repository.js";

/** Filters for querying audit logs. [Phase 3.5 AC6] */
export interface AuditQueryFilters {
  projectId?: string;
  action?: string;
  from?: string; // ISO date
  to?: string;   // ISO date
}

export interface AuditLogRepository extends AuditLogSink {
  /** Return all persisted entries (test helper). */
  findAll(): Promise<AuditEntry[]>;
  /** Query audit log entries with filtering and pagination. [Phase 3.5 AC6] */
  query?(filters: AuditQueryFilters, page: number, pageSize: number): Promise<PaginatedResult<AuditEntry>>;
}

/**
 * In-memory implementation for tests and local development.
 */
export class InMemoryAuditLogRepository implements AuditLogRepository {
  private readonly entries: AuditEntry[] = [];

  async record(entry: AuditEntry): Promise<void> {
    this.entries.push({ ...entry });
  }

  async findAll(): Promise<AuditEntry[]> {
    return [...this.entries];
  }

  async query(filters: AuditQueryFilters, page: number, pageSize: number): Promise<PaginatedResult<AuditEntry>> {
    const filtered = this.entries.filter((e) => {
      if (filters.projectId && e.projectId !== filters.projectId) return false;
      if (filters.action && e.action !== filters.action) return false;
      return true;
    });
    const start = (page - 1) * pageSize;
    return {
      items: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
    };
  }
}

/**
 * Drizzle-backed implementation for production persistence. [AC3]
 */
export class DrizzleAuditLogRepository implements AuditLogRepository {
  constructor(private readonly db: DbClient) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.db.insert(auditLogs).values({
      projectId: entry.projectId,
      actorType: entry.actorType,
      actorId: entry.actorId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      detailsJson: entry.details ?? null,
    });
  }

  async findAll(): Promise<AuditEntry[]> {
    const rows = await this.db.select().from(auditLogs);
    return rows.map((r) => this.mapRow(r));
  }

  private mapRow(r: typeof auditLogs.$inferSelect): AuditEntry {
    return {
      projectId: r.projectId,
      actorType: r.actorType,
      actorId: r.actorId,
      action: r.action,
      resourceType: r.resourceType,
      resourceId: r.resourceId,
      details: (r.detailsJson as Record<string, unknown>) ?? undefined,
    };
  }

  async query(filters: AuditQueryFilters, page: number, pageSize: number): Promise<PaginatedResult<AuditEntry>> {
    const { and, eq, gte, lte, count } = await import("drizzle-orm");
    const conditions = [];
    if (filters.projectId) conditions.push(eq(auditLogs.projectId, filters.projectId));
    if (filters.action) conditions.push(eq(auditLogs.action, filters.action));
    if (filters.from) conditions.push(gte(auditLogs.createdAt, new Date(filters.from)));
    if (filters.to) conditions.push(lte(auditLogs.createdAt, new Date(filters.to)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await this.db
      .select({ total: count() })
      .from(auditLogs)
      .where(where);

    const rows = await this.db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(auditLogs.createdAt)
      .offset((page - 1) * pageSize)
      .limit(pageSize);

    return {
      items: rows.map((r) => this.mapRow(r)),
      total: countResult?.total ?? 0,
      page,
      pageSize,
    };
  }
}
