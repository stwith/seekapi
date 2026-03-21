/**
 * Repository for persisting audit log entries. [AC3]
 *
 * The `AuditLogSink` interface is defined by the audit service.
 * This module provides an in-memory implementation for tests and
 * a repository interface for future DB-backed persistence.
 */

import type {
  AuditEntry,
  AuditLogSink,
} from "../../../modules/audit/service/audit-service.js";

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
