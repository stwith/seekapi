import { describe, it, expect, vi } from "vitest";
import {
  UsageService,
  type UsageEvent,
  type UsageEventSink,
} from "../../src/modules/usage/service/usage-service.js";
import {
  AuditService,
  type AuditEntry,
  type AuditLogSink,
} from "../../src/modules/audit/service/audit-service.js";

/* ------------------------------------------------------------------ */
/*  In-memory sinks for testing                                       */
/* ------------------------------------------------------------------ */

function makeUsageSink(): UsageEventSink & { events: UsageEvent[] } {
  const events: UsageEvent[] = [];
  return {
    events,
    record: vi.fn(async (e: UsageEvent) => {
      events.push(e);
    }),
  };
}

function makeAuditSink(): AuditLogSink & { entries: AuditEntry[] } {
  const entries: AuditEntry[] = [];
  return {
    entries,
    record: vi.fn(async (e: AuditEntry) => {
      entries.push(e);
    }),
  };
}

/* ------------------------------------------------------------------ */
/*  UsageService                                                      */
/* ------------------------------------------------------------------ */

describe("UsageService", () => {
  it("successful search emits usage event", async () => {
    const sink = makeUsageSink();
    const svc = new UsageService(sink);

    await svc.recordSuccess({
      requestId: "req_001",
      projectId: "proj_001",
      apiKeyId: "key_001",
      provider: "brave",
      capability: "search.web",
      latencyMs: 120,
      resultCount: 10,
      fallbackCount: 0,
    });

    expect(sink.events).toHaveLength(1);
    const event = sink.events[0];
    expect(event.success).toBe(true);
    expect(event.statusCode).toBe(200);
    expect(event.provider).toBe("brave");
    expect(event.capability).toBe("search.web");
    expect(event.resultCount).toBe(10);
    expect(event.fallbackCount).toBe(0);
  });

  it("fallback search increments fallback count", async () => {
    const sink = makeUsageSink();
    const svc = new UsageService(sink);

    await svc.recordSuccess({
      requestId: "req_002",
      projectId: "proj_001",
      apiKeyId: "key_001",
      provider: "google",
      capability: "search.web",
      latencyMs: 250,
      resultCount: 5,
      fallbackCount: 1,
    });

    expect(sink.events).toHaveLength(1);
    const event = sink.events[0];
    expect(event.success).toBe(true);
    expect(event.fallbackCount).toBe(1);
    expect(event.provider).toBe("google");
  });

  it("auth failure does not create a success usage event", async () => {
    const sink = makeUsageSink();
    const svc = new UsageService(sink);

    await svc.recordFailure({
      requestId: "req_003",
      projectId: "proj_001",
      apiKeyId: "key_001",
      provider: "brave",
      capability: "search.web",
      statusCode: 401,
      latencyMs: 5,
      errorCode: "AUTH_FAILED",
    });

    expect(sink.events).toHaveLength(1);
    const event = sink.events[0];
    expect(event.success).toBe(false);
    expect(event.statusCode).toBe(401);
    expect(event.resultCount).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  AuditService                                                      */
/* ------------------------------------------------------------------ */

describe("AuditService", () => {
  it("logs audit entries via sink", async () => {
    const sink = makeAuditSink();
    const svc = new AuditService(sink);

    await svc.log({
      projectId: "proj_001",
      actorType: "api_key",
      actorId: "key_001",
      action: "credential.rotate",
      resourceType: "credential",
      resourceId: "cred_001",
      details: { reason: "scheduled rotation" },
    });

    expect(sink.entries).toHaveLength(1);
    expect(sink.entries[0].action).toBe("credential.rotate");
    expect(sink.entries[0].details).toEqual({ reason: "scheduled rotation" });
  });
});
