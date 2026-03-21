/**
 * Audit service — records audit log entries for security-sensitive operations.
 *
 * Accepts an `AuditLogSink` for persistence so callers can inject
 * a real DB writer or an in-memory sink for tests.
 */

export interface AuditEntry {
  projectId: string;
  actorType: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: Record<string, unknown>;
}

/** Persistence sink — implemented by DB repository or in-memory store. */
export interface AuditLogSink {
  record(entry: AuditEntry): Promise<void>;
}

export class AuditService {
  private readonly sink: AuditLogSink;

  constructor(sink: AuditLogSink) {
    this.sink = sink;
  }

  async log(entry: AuditEntry): Promise<void> {
    await this.sink.record(entry);
  }
}
