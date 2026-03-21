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

export interface AuditLogRepository extends AuditLogSink {
  /** Return all persisted entries (test helper). */
  findAll(): Promise<AuditEntry[]>;
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
    return rows.map((r) => ({
      projectId: r.projectId,
      actorType: r.actorType,
      actorId: r.actorId,
      action: r.action,
      resourceType: r.resourceType,
      resourceId: r.resourceId,
      details: (r.detailsJson as Record<string, unknown>) ?? undefined,
    }));
  }
}
